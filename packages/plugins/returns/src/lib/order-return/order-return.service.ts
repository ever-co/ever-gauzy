import {
	BadRequestException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	IOrderLineReceiptMove,
	IOrderReturnLineInput,
	IOrderReturnReceiptOutcome,
	IOrderReturnReceiptInput,
	IOrderTotalsPort,
	IRefundGatewayPort,
	IRefundResult,
	IReturnShipmentPort,
	IReturnShipmentResult,
	IStockLedgerPort,
	OrderReturnStatus,
	RETURNS_ORDER_TOTALS,
	RETURNS_RECEIPT_REASON,
	RETURNS_REFUND_GATEWAY,
	RETURNS_SHIPMENT_GATEWAY,
	RETURNS_STOCK_LEDGER,
	RETURNS_TOTALS_REASON,
	StockMovementKind
} from '../returns.types';
import { fromQuantityUnits, subtractQuantities, sumQuantities, toQuantityUnits } from '../returns.quantity';
import {
	ApiErrorCode,
	ApiException,
	EventOutboxService,
	IVersionExpectation,
	LegacyFindOneOptions,
	Money,
	MultiORMEnum,
	RequestContext,
	SequenceService,
	TenantAwareCrudService,
	commitVersionedUpdate
} from '@gauzy/core';
import { OrderReturnLine } from '../order-return-line/order-return-line.entity';
import {
	IOrderReturnReceiptPlan,
	LIVE_RETURN_STATUSES,
	OrderReturnLineService
} from '../order-return-line/order-return-line.service';
import { OrderReturn } from './order-return.entity';
import { MikroOrmOrderReturnRepository } from './repository/mikro-orm-order-return.repository';
import { TypeOrmOrderReturnRepository } from './repository/type-orm-order-return.repository';

/** The series key returns are numbered from. */
const RETURN_NUMBER_KEY = 'RETURN';

/**
 * The aggregate name every `return.*` outbox row is written under.
 *
 * The outbox partitions by `<aggregateType>:<aggregateId>` and promises ordering inside a partition
 * and nowhere else, so this string is what makes "one return's events arrive in the order they
 * happened" true: a refund cannot be announced before the receipt that made it payable.
 */
const RETURN_AGGREGATE_TYPE = 'ORDER_RETURN';

/**
 * The `return.*` facts this domain announces.
 *
 * A return is the point at which goods and money move in the opposite direction, and every context
 * downstream of it — the search index, the buyer's notifications, an outbound webhook, the accounting
 * export — has to be told. This package announced nothing at all, so none of them could be. The set
 * is the lifecycle, because a lifecycle move is what another context acts on; an edit of a note is
 * not. Naming them here keeps the set answerable by a subscriber that asks what `return.*` contains.
 */
const RETURN_EVENTS = {
	/** A customer or an operator asked to send goods back. */
	REQUESTED: 'return.requested',
	/** The request was granted; the customer may ship. */
	APPROVED: 'return.approved',
	/** The request was refused. */
	REJECTED: 'return.rejected',
	/** The request was withdrawn before anything moved. */
	CANCELED: 'return.canceled',
	/** Goods arrived, in full or in part, and stock moved. */
	RECEIVED: 'return.received',
	/** Money went back against the return. */
	REFUNDED: 'return.refunded',
	/** Nothing further can happen to the return. */
	CLOSED: 'return.closed'
} as const;

/**
 * The version a write is predicated on when no caller stated one.
 *
 * A write the platform makes on its own behalf — a receipt compensating itself, a caller inside the
 * platform moving a return on — has no version a client accepted, and refusing it would make the
 * aggregate unwritable from anywhere but a route. The wildcard is not an escape from the protection:
 * the version is read from the row and the UPDATE is still predicated on it, so a version that moved
 * on between that read and the write is refused exactly as it is for a stated one.
 */
const ANY_VERSION: IVersionExpectation = { wildcard: true, versions: [] };

/**
 * The expectation that pins one exact version.
 *
 * Used where one request writes the same return twice — a receipt and the refund that follows it —
 * because the second write has to be predicated on the version the first one produced, or it would
 * be refused as a conflict by the very write it follows.
 *
 * @param version The version the return holds.
 * @returns The expectation to predicate the next write on.
 */
function exactly(version: number): IVersionExpectation {
	return { wildcard: false, versions: [version] };
}

/**
 * The expectation that pins the version a write read the return at, when the row carries one.
 *
 * Used by a write the platform decides on its own reading of the row — the retirement of a live return — so
 * that any write of the aggregate between that reading and the statement, a receipt that left the status
 * where it was included, refuses it rather than being overwritten by it.
 *
 * @param orderReturn The return as it was read.
 * @returns The expectation to predicate the write on.
 */
function asRead(orderReturn: OrderReturn): IVersionExpectation {
	const version = Number(orderReturn.version);

	return Number.isInteger(version) && version > 0 ? exactly(version) : ANY_VERSION;
}

/** Statuses a return may still be approved, rejected or cancelled from. */
const DECIDABLE_STATUSES: OrderReturnStatus[] = [
	OrderReturnStatus.OPEN,
	OrderReturnStatus.REQUESTED,
	OrderReturnStatus.APPROVED
];

/** Statuses that may be received into. */
const RECEIVABLE_STATUSES: OrderReturnStatus[] = [OrderReturnStatus.APPROVED, OrderReturnStatus.PARTIALLY_RECEIVED];

/** One movement a receipt will ask the ledger for, resolved against a line and a location. */
interface IPlannedMovement {
	/** Location the goods moved at. */
	warehouseId: ID;
	/** Variant that moved. */
	variantId: ID;
	/** Quantity this delivery moved, which is this delivery's share and never the line's running total. */
	quantity: string;
	/** What kind of movement this is. */
	kind: StockMovementKind;
	/**
	 * Whether these units ever entered the location's stock.
	 *
	 * A restocked unit did, once it is received, and its quantity lands on the level. A unit that came
	 * back unsellable or arrived damaged never did — it is recorded as an event about the units, and the
	 * level is left where it is, which is what keeps units the platform cannot sell out of the number it
	 * sells against.
	 */
	eventOnly: boolean;
	/** Why the movement happened. */
	reason: string;
}

/** One movement the ledger accepted, kept so a receipt that cannot finish can be reversed. */
interface IPostedMovement extends IPlannedMovement {
	/** The ledger's own row, when it reported one. */
	movementId?: ID;
}

/**
 * What a receipt has done so far, recorded as each step completes.
 *
 * The compensation reads this rather than the plan: the plan is what the receipt meant to do, and a
 * relative move undone for a step that never ran moves a counter by units nobody added.
 */
interface IReceiptSteps {
	/** Whether the write of the return's own lines started; their restore is absolute, so it is safe then. */
	linesTouched: boolean;
	/** The moves of the order's received-return counter the order accepted, which are what is moved back. */
	orderLineMoves: IOrderLineReceiptMove[];
	/** The stock movements the ledger accepted, in the order it accepted them. */
	posted: IPostedMovement[];
	/** Whether the receipt's own header write landed, which is the only case its restore is owed. */
	headerWritten: boolean;
}

/**
 * Goods coming back: the authorisation, the receipt, and the money that follows it.
 *
 * The lifecycle is explicit because each transition has a consequence outside this table. Approving
 * decides whether the customer may ship at all; receiving is the moment stock moves and the refund
 * becomes payable; closing is the moment nothing further can happen. A return can therefore be
 * received in parts, rejected after it was approved, or cancelled before anything moved, and each of
 * those is a state rather than a deletion.
 *
 * Two capabilities are reached through ports rather than implemented here, because they belong to
 * other domains: the stock ledger the received units are written to, and the refund that sends money
 * back. Both are injected optionally — a tenant with neither can still run the lifecycle — but a
 * receipt that has units to move and no ledger fails loudly instead of adjusting a level itself.
 *
 * **Every lifecycle move announces itself, from inside the write that made it.** A return is where
 * goods and money travel back, so the search index, the buyer's notifications, an outbound webhook and
 * the accounting export all have to be told — and this package told none of them, because it emitted
 * nothing at all. Each move now appends a `return.*` row to the platform outbox in `commitHeader`,
 * immediately after the conditional statement returned and through the return repository's own entity
 * manager: a refused statement throws before the append is reached, so no event describes a move that
 * did not happen, and an event that is a row cannot be lost by a crash the way one published over a
 * bus after the commit can.
 *
 * Every write of the header goes through `commitVersionedUpdate`, which is what makes the return an
 * optimistically concurrent aggregate rather than a row two people can overwrite in turn. A route
 * states the version its caller read; a write the platform makes on its own behalf is predicated on
 * the version the row holds, which is the same statement either way. The version is never written by
 * this class — it is set by the conditional update, in the same statement that checks it.
 */
@Injectable()
export class OrderReturnService extends TenantAwareCrudService<OrderReturn> {
	/** Where a failure that must not be thrown — a compensation that did not land — is reported. */
	private readonly logger = new Logger(OrderReturnService.name);

	constructor(
		readonly typeOrmOrderReturnRepository: TypeOrmOrderReturnRepository,
		readonly mikroOrmOrderReturnRepository: MikroOrmOrderReturnRepository,
		private readonly lineService: OrderReturnLineService,
		private readonly sequenceService: SequenceService,
		private readonly outbox: EventOutboxService,
		@Optional()
		@Inject(RETURNS_STOCK_LEDGER)
		private readonly stockLedger?: IStockLedgerPort,
		@Optional()
		@Inject(RETURNS_REFUND_GATEWAY)
		private readonly refundGateway?: IRefundGatewayPort,
		@Optional()
		@Inject(RETURNS_SHIPMENT_GATEWAY)
		private readonly shipmentGateway?: IReturnShipmentPort,
		@Optional()
		@Inject(RETURNS_ORDER_TOTALS)
		private readonly orderTotals?: IOrderTotalsPort
	) {
		super(typeOrmOrderReturnRepository, mikroOrmOrderReturnRepository);
	}

	/**
	 * Requests a return against an order.
	 *
	 * The number is allocated from the `RETURN` series, and the lines are validated against the
	 * fulfilled quantities of the order before any of them is written — the ceiling is the whole
	 * point of the request, so it is checked before the header exists rather than after.
	 *
	 * @param entity The return to create, with its requested lines.
	 * @returns The created return, with its lines.
	 */
	public async create(
		entity: Partial<OrderReturn> & { lines?: Array<{ orderLineId: ID; quantity: number | string }> }
	): Promise<OrderReturn> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { lines = [], ...header } = entity;

		if (!header.orderId) {
			throw new BadRequestException('A return must name the order it is against.');
		}

		if (!header.currency) {
			throw new BadRequestException('A return must state the currency its amounts are in.');
		}

		if (!lines.length) {
			throw new BadRequestException('A return needs at least one line.');
		}

		// Validate the request against what was fulfilled before writing anything.
		await this.lineService.assertReturnable(header.orderId, lines);

		const number = await this.allocateNumber();

		const orderReturn = await super.create({
			...header,
			number,
			status: OrderReturnStatus.OPEN,
			requestedAt: new Date(),
			noNotification: header.noNotification ?? false,
			refundAmount: this.normalizeAmount(header.refundAmount, header.currency),
			tenantId,
			organizationId
		} as any);

		orderReturn.lines = await this.lineService.replaceLines(orderReturn.id, lines as any);

		// Announced after the lines exist, because what a consumer of a return request acts on is the
		// lines: a request with none is not something a warehouse could expect goods against.
		await this.announce(RETURN_EVENTS.REQUESTED, orderReturn, Number(orderReturn.version ?? 1), {
			lineCount: orderReturn.lines.length
		});

		return orderReturn;
	}

	/**
	 * Replaces the line set of a return that has not been received yet.
	 *
	 * The lines are owned by `OrderReturnLineService`, which is the only writer of them and the only
	 * place the fulfilled-quantity ceiling is checked; this method exists so a caller holding the
	 * return can edit it without reaching for another service.
	 *
	 * @param id The return to write the lines of.
	 * @param lines The requested lines.
	 * @returns The written lines.
	 */
	public async replaceLines(id: ID, lines: IOrderReturnLineInput[]): Promise<OrderReturnLine[]> {
		return await this.lineService.replaceLines(id, lines);
	}

	/**
	 * Approves a requested return, which is what lets the customer ship the goods back.
	 *
	 * @param id The return to approve.
	 * @param note An optional operator note appended to the return.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The approved return.
	 */
	public async approve(id: ID, note?: string, expectation: IVersionExpectation = ANY_VERSION): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, [OrderReturnStatus.OPEN, OrderReturnStatus.REQUESTED], 'approve');

		await this.commitHeader(
			orderReturn,
			{
				status: OrderReturnStatus.APPROVED,
				approvedAt: new Date(),
				note: note ?? orderReturn.note
			},
			expectation,
			{ name: RETURN_EVENTS.APPROVED }
		);

		return await this.findOneScoped(id);
	}

	/**
	 * Rejects a return. Terminal: a rejected return no longer counts against the order's fulfilled
	 * quantity, which is what lets the customer ask again with a corrected request — and the order's
	 * requested-return counter is moved back by what it no longer asks for (see {@link withdraw}).
	 *
	 * @param id The return to reject.
	 * @param reason Why it was rejected.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The rejected return.
	 */
	public async reject(id: ID, reason?: string, expectation: IVersionExpectation = ANY_VERSION): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, DECIDABLE_STATUSES, 'reject');

		await this.withdraw(
			orderReturn,
			{
				status: OrderReturnStatus.REJECTED,
				reason: reason ?? orderReturn.reason
			},
			expectation,
			{ name: RETURN_EVENTS.REJECTED, data: { reason: reason ?? orderReturn.reason ?? null } }
		);

		return await this.findOneScoped(id);
	}

	/**
	 * Cancels a return before its goods were received, which moves the order's requested-return counter
	 * back exactly as a rejection does (see {@link withdraw}).
	 *
	 * @param id The return to cancel.
	 * @param reason Why it was cancelled.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The cancelled return.
	 */
	public async cancel(id: ID, reason?: string, expectation: IVersionExpectation = ANY_VERSION): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, DECIDABLE_STATUSES, 'cancel');

		await this.withdraw(
			orderReturn,
			{
				status: OrderReturnStatus.CANCELED,
				canceledAt: new Date(),
				reason: reason ?? orderReturn.reason
			},
			expectation,
			{ name: RETURN_EVENTS.CANCELED, data: { reason: reason ?? orderReturn.reason ?? null } }
		);

		return await this.findOneScoped(id);
	}

	/**
	 * Withdraws a return — rejects, cancels or retires it — and takes back from the order what it asked for.
	 *
	 * A withdrawn return no longer counts against the order (doc 10 §11.7: "returnRequestedQuantity
	 * reverted"), so each order line's requested-return counter moves down by the units the return still
	 * had outstanding. Two things are ordered deliberately:
	 *
	 * - **the counter moves first**, so a move the order refuses — a counter the request was never added to
	 *   would go below zero — refuses the withdrawal while the return is still exactly as it was;
	 * - **the header write is predicated on the status the return was read in** as well as on its version.
	 *   Two withdrawals of one return read in the same state would otherwise both release its units — a
	 *   caller that states no version is predicated on the version the row holds when its write runs, and
	 *   that is the one the first withdrawal just produced — and the second release would subtract units
	 *   another return of the same line asked for. With the status in the predicate the second write
	 *   changes no row, and its release is moved back.
	 *
	 * A header write that did not land moves the counter back by exactly the moves that landed. A header
	 * write that did land — the event after it threw — keeps the release, because the return is
	 * withdrawn. Which of the two happened is recorded by the write itself rather than read back from the
	 * row: a row another writer moved on in the meantime reads as "moved" too, and giving the units back
	 * then would leave them released for a withdrawal that never happened.
	 *
	 * @param orderReturn The return as it was read.
	 * @param patch The terminal status and what goes with it, or the retirement stamp.
	 * @param expectation The version the caller read, when the route stated one.
	 * @param event The fact the withdrawal announces, when it announces one; a retirement announces none.
	 */
	private async withdraw(
		orderReturn: OrderReturn,
		patch: Record<string, unknown>,
		expectation: IVersionExpectation,
		event?: { name: string; data?: Record<string, unknown> }
	): Promise<void> {
		// The status the withdrawal was decided from, taken before anything else runs: the entity in hand
		// may be the instance a store hands every reader of the row, and the precondition must be the state
		// this caller read rather than whatever that instance says by the time the header is written.
		const decidedFrom = orderReturn.status;

		await this.whileReleased(orderReturn, (landed) =>
			this.commitHeader(orderReturn, patch, expectation, event, {
				precondition: { status: decidedFrom },
				onCommitted: landed
			})
		);
	}

	/**
	 * Runs the write that takes a live return out of what the order counts, with its outstanding units
	 * released first, and puts them back when the write did not land.
	 *
	 * The write reports that it landed through the callback it is handed, the moment it did — before anything
	 * after it that can still throw — which is what tells a failure of the write apart from a failure after
	 * it: the first moves the counter back, the second keeps the release, because the return is out.
	 *
	 * @param orderReturn The return as it was read.
	 * @param write The write, handed the callback it calls once it landed.
	 * @returns What the write answered.
	 */
	private async whileReleased<R>(orderReturn: OrderReturn, write: (landed: () => void) => Promise<R>): Promise<R> {
		const released = await this.lineService.releaseOrderLineRequest(orderReturn.id, orderReturn.orderId);
		let withdrawn = false;

		try {
			return await write(() => {
				withdrawn = true;
			});
		} catch (error) {
			if (!withdrawn) {
				try {
					await this.lineService.restoreOrderLineRequest(orderReturn.orderId, released);
				} catch (compensationError) {
					this.logger.error(
						`The withdrawal of return ${orderReturn.id} failed and the order's requested counter could not ` +
							`be put back: ${describe(compensationError)}`
					);
				}
			}

			throw error;
		}
	}

	/**
	 * Retires a return recoverably — and, while it still counts against the order, withdraws it.
	 *
	 * The inherited `DELETE /order-returns/:id/soft` and the GraphQL `softDeleteOrderReturn` field both reach
	 * this method, and the resolver documents what they are for: "the withdrawal a return needs rather than a
	 * destructive one". A retired return leaves every read of the returns and the fulfilled ceiling a new
	 * request is measured against, so while it is live the order's requested counter would otherwise go on
	 * counting units nothing asks for any more — the next return of the same units then pushes it past what
	 * any live return asks, and doc 10 I-12 is measured against a number that has drifted. It is therefore
	 * retired the way a rejection or a cancellation withdraws it (see {@link withdraw}): what it still had
	 * outstanding is released first, and the retirement is one version-predicated write of the header,
	 * predicated on the status it was decided from and on the version it was read at — so a withdrawal or a
	 * receipt that lands in between refuses it, and its release is moved back.
	 *
	 * A return that no longer counts — rejected or cancelled, which gave its units back already — is retired
	 * as it always was. A return that is not the caller's is not found, which is what the lifecycle moves
	 * answer too; the platform's own read would have found one of another organization of the tenant.
	 *
	 * @param id The return to retire.
	 * @param options Find options the platform narrows its own read with, forwarded unchanged.
	 * @param saveOptions The platform's save options, forwarded unchanged.
	 * @returns The retired return.
	 * @throws NotFoundException when the return is not the caller's.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the return moved on after it was read.
	 */
	public async softRemove(
		id: ID,
		options?: LegacyFindOneOptions<OrderReturn>,
		saveOptions?: SaveOptions
	): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		if (!LIVE_RETURN_STATUSES.includes(orderReturn.status)) {
			return await super.softRemove(id, options, saveOptions);
		}

		await this.withdraw(orderReturn, { deletedAt: new Date() }, asRead(orderReturn));

		return (await this.readScoped(id, true)) as OrderReturn;
	}

	/**
	 * Removes a return for good — and, while it still counts against the order, withdraws it first.
	 *
	 * The inherited `DELETE /order-returns/:id` and the GraphQL `deleteOrderReturn` field reach this method.
	 * The lines go with the row (`ON DELETE CASCADE`), so a live return's outstanding units are released
	 * exactly as {@link softRemove} releases them, and the statement is predicated on the status and the
	 * version the return was read at: a statement that matched no row is a return that moved on in between,
	 * which is refused as the conflict it is and its release moved back. A return that no longer counts, or
	 * one already retired, is removed as it always was.
	 *
	 * @param criteria The return to remove, by its identifier. Conditions are handed to the platform as they
	 * always were.
	 * @param options Find options the platform merges into the statement, forwarded unchanged.
	 * @returns The delete result.
	 * @throws NotFoundException when the return is not the caller's.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the return moved on after it was read.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<OrderReturn>,
		options?: LegacyFindOneOptions<OrderReturn>
	): Promise<DeleteResult> {
		if (typeof criteria !== 'string') {
			return await super.delete(criteria, options);
		}

		// A retired return is read too: its retirement gave its units back already, and it is removed as it
		// always was.
		const orderReturn = await this.readScoped(criteria, true);

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		if (orderReturn.deletedAt || !LIVE_RETURN_STATUSES.includes(orderReturn.status)) {
			return await super.delete(criteria, options);
		}

		const decidedFrom = orderReturn.status;
		const expectation = asRead(orderReturn);

		return await this.whileReleased(orderReturn, async (landed) => {
			const removed = await super.delete(
				{
					id: orderReturn.id,
					status: decidedFrom,
					...(expectation.wildcard ? {} : { version: expectation.versions[0] })
				} as FindOptionsWhere<OrderReturn>,
				options
			);

			if (!removed?.affected) {
				throw new ApiException(
					HttpStatus.CONFLICT,
					ApiErrorCode.ENTITY_VERSION_CONFLICT,
					'The return changed since it was read. Read it again and retry the removal.'
				);
			}

			landed();

			return removed;
		});
	}

	/**
	 * Restores a retired return — and, when that makes it count against the order again, asks for its units.
	 *
	 * The inherited `PUT /order-returns/:id/recover` and the GraphQL `recoverOrderReturn` field reach this
	 * method. A live return's retirement gave its outstanding units back, so its restoration takes them
	 * again: the return is measured against the fulfilled ceiling first — another return may have asked for
	 * the same units while this one was retired, and restoring it then would ask back more than shipped —
	 * its outstanding units are asked for, and they are given back if the restoration does not land. A
	 * return that does not count once restored, or one that was never retired, is restored as it always was.
	 *
	 * @param id The return to restore.
	 * @param options Find options the platform narrows its own read with, forwarded unchanged.
	 * @param saveOptions The platform's save options, forwarded unchanged.
	 * @returns The restored return.
	 * @throws NotFoundException when the return is not the caller's.
	 * @throws BadRequestException when the restored return would ask back more than was fulfilled.
	 */
	public async softRecover(
		id: ID,
		options?: LegacyFindOneOptions<OrderReturn>,
		saveOptions?: SaveOptions
	): Promise<OrderReturn> {
		const orderReturn = await this.readScoped(id, true);

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		if (!orderReturn.deletedAt || !LIVE_RETURN_STATUSES.includes(orderReturn.status)) {
			return await super.softRecover(id, options, saveOptions);
		}

		const lines = await this.lineService.findForReturn(orderReturn.id);

		await this.lineService.assertReturnable(
			orderReturn.orderId,
			lines.map((line) => ({ orderLineId: line.orderLineId as ID, quantity: line.quantity })),
			orderReturn.id
		);

		const reclaimed = await this.lineService.reclaimOrderLineRequest(orderReturn.id, orderReturn.orderId);

		try {
			return await super.softRecover(id, options, saveOptions);
		} catch (error) {
			try {
				await this.lineService.restoreOrderLineRequest(orderReturn.orderId, reclaimed);
			} catch (compensationError) {
				this.logger.error(
					`The restoration of return ${orderReturn.id} failed and the order's requested counter could not ` +
						`be put back: ${describe(compensationError)}`
				);
			}

			throw error;
		}
	}

	/**
	 * Receives goods back.
	 *
	 * This is the transition the whole domain exists for, and it happens in one order:
	 *
	 * 1. the whole receipt is stated — what every line will hold once this delivery is written, and
	 *    every stock movement the ledger will be asked for — before anything is written, so a receipt
	 *    whose quantities or locations cannot be posted is refused while the return is still exactly as
	 *    it was;
	 * 2. the lines are written, accumulating onto what earlier deliveries already recorded;
	 * 3. a stock movement is written for every unit this delivery brought — a `RETURN` for the units
	 *    going back on the shelf, a `WRITE_OFF` for the units that came back unsellable, and a
	 *    `DAMAGE` record for the ones that arrived broken — through the ledger, never by writing a
	 *    level here;
	 * 4. the return moves to `RECEIVED` or `PARTIALLY_RECEIVED`, so the refund that follows is issued
	 *    against a return that already says the goods are in;
	 * 5. only then is the refund issued, so money never leaves for goods the ledger refused.
	 *
	 * **A failure in steps 2–3 compensates fully and the return stays where it was** (doc 10 §11.6):
	 * the movements that were posted are reversed in the ledger and the lines are put back to what
	 * they held, so a receipt whose goods never went back into stock is never recorded as if they had.
	 * Nothing compensates a failure in step 5 — the goods physically arrived, so the inventory is
	 * right, and un-posting them to retry a payment would be the worse error.
	 *
	 * A partial receipt leaves the return `PARTIALLY_RECEIVED` and keeps the remainder outstanding;
	 * the same lines can be received again, and the delivery that completes the request moves the
	 * return to `RECEIVED`. Closing is deliberately not automatic: a fully received return that is
	 * still being inspected must stay open, and `close` is what ends it.
	 *
	 * @param id The return being received.
	 * @param lines The quantities that arrived, per line.
	 * @param options The receiving location, the refund to issue and an operator note.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns What the receipt did, including the version the return now holds.
	 */
	public async receive(
		id: ID,
		lines: IOrderReturnReceiptInput[],
		options: { warehouseId?: ID; refund?: string | number; note?: string } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<IOrderReturnReceiptOutcome> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, RECEIVABLE_STATUSES, 'receive');

		// The status the receipt was decided from, taken before anything else runs, for the reason
		// `withdraw` takes it: the header write below is predicated on it (see there).
		const decidedFrom = orderReturn.status;

		// **What the receipt actually did, step by step, so its compensation undoes only that.** The
		// compensation used to be handed the plan and undo all of it, whatever had run: a receipt refused
		// in `planMovements` — a line with no receiving location — never reached the order, and moving the
		// order's counter back by its plan subtracted units another return of the same line had put there,
		// once per retry. Each step is recorded as it completes: the lines as soon as their write *starts*
		// (the restore writes absolute values, so a write that failed half-way is still put back), the
		// order's counter only once the port answered (the port is all or nothing, so a call that threw
		// moved nothing), every stock movement as the ledger accepts it, and the header the moment its
		// conditional write returned — before the event after it, which can still throw.
		const steps: IReceiptSteps = { linesTouched: false, orderLineMoves: [], posted: [], headerWritten: false };
		let plan: IOrderReturnReceiptPlan[] = [];
		let settlement = { received: '0', outstanding: '0' };
		let version: number;

		try {
			const fulfilled = await this.lineService.readFulfilledLines(orderReturn.orderId);
			plan = await this.lineService.planReceipt(id, lines);

			const movements = this.planMovements(orderReturn, plan, fulfilled, options.warehouseId);

			settlement = this.summarize(plan);

			const status =
				toQuantityUnits(settlement.outstanding) === 0n
					? OrderReturnStatus.RECEIVED
					: OrderReturnStatus.PARTIALLY_RECEIVED;

			steps.linesTouched = true;
			await this.lineService.applyReceipt(plan);
			// Step 2 of doc 10 §11.6 is one step, not two: the return's own lines and the order's
			// received-return counter move together, because the counter is what the order's
			// `fulfillmentStatus` is derived from and a receipt the order was never told about leaves it
			// answering a status the goods in its own warehouse deny. The compensation below is owed
			// both halves for the same reason — and only the half of it that landed.
			steps.orderLineMoves = await this.lineService.applyOrderLineReceipt(orderReturn.orderId, plan);

			for (const movement of movements) {
				steps.posted.push(await this.postMovement(orderReturn, movement));
			}

			// The status is written last, and the refund below reads it: the refund guard refuses a
			// return that has not received anything, which is the check that keeps money behind goods.
			//
			// **It is predicated on the status the receipt was decided from**, as a withdrawal's is. A
			// cancellation that read the lines before this receipt moved them released every unit the return
			// asked for; a receipt that then wrote `RECEIVED` over `CANCELED` — which a caller that states no
			// version was free to do, being predicated on whatever version the row holds by then — left the
			// order with units received against none requested, doc 10 I-12 broken by two writes that each
			// landed. With the status in the predicate that write changes no row, and the compensation below
			// takes the receipt back off the lines, the ledger and the order.
			version = await this.commitHeader(
				orderReturn,
				{
					status,
					receivedAt: new Date(),
					warehouseId: options.warehouseId ?? orderReturn.warehouseId,
					note: options.note ?? orderReturn.note
				},
				expectation,
				{
					name: RETURN_EVENTS.RECEIVED,
					data: {
						receivedQuantity: settlement.received,
						outstandingQuantity: settlement.outstanding,
						warehouseId: options.warehouseId ?? orderReturn.warehouseId ?? null
					}
				},
				{
					precondition: { status: decidedFrom },
					onCommitted: () => {
						steps.headerWritten = true;
					}
				}
			);
		} catch (error) {
			// **A compensation that fails must not replace the reason the receipt failed.** This block
			// threw the compensation's own exception out of the method, so the caller — and the operator
			// reading the log — was told "ORDER_LINE_RECEIPT_BELOW_ZERO" about a receipt whose real cause
			// was something else entirely, and the original failure was never reported anywhere. The
			// compensation is best-effort by nature (it is undoing writes that only partly landed), so its
			// failure is logged beside the original rather than thrown instead of it.
			try {
				await this.compensateReceipt(orderReturn, plan, steps);
			} catch (compensationError) {
				this.logger.error(
					`The receipt of return ${orderReturn.id} failed and its compensation failed too: ` +
						`${describe(compensationError)}`
				);
			}

			throw error;
		}

		const updated = await this.findOneScoped(id);

		// The receipt moved the order's own received-return counter, and that counter is one of the five
		// sums `deriveFulfillmentStatus` reads — so this is a move ADR-26 owes a recompute for, and it is
		// owed whether or not a refund follows: a receipt that refunds nothing has still moved the goods
		// half of the return, which is what decides `PARTIALLY_RETURNED` against `RETURNED` (doc 10
		// §11.7). A refunding receipt is recomputed twice — once here for the goods and once in
		// `settleRefund` for the money — because the two moves are two changes to the ledgers the
		// derivation reads, which is exactly what the ADR says to recompute on.
		await this.refreshOrderTotals(orderReturn.orderId, RETURNS_RECEIPT_REASON);

		let refund: IRefundResult | undefined;

		if (options.refund !== undefined && options.refund !== null && String(options.refund) !== '') {
			// The refund is the second write of one request, so it is predicated on the version the
			// receipt just produced rather than on the one the caller read: the version it stated has
			// already been spent, and stating it again would be refused as a conflict.
			const settled = await this.settleRefund(id, options.refund, undefined, options.note, exactly(version));

			refund = settled.refund;
			version = settled.version;
		}

		return {
			returnId: updated.id,
			status: updated.status,
			version,
			movementIds: steps.posted
				.map((movement) => movement.movementId)
				.filter((movementId): movementId is ID => !!movementId),
			refund,
			receivedQuantity: settlement.received,
			outstandingQuantity: settlement.outstanding
		};
	}

	/**
	 * Refunds a received return through the payment capability.
	 *
	 * The amount is normalised at the currency's scale through the platform money layer before it is
	 * recorded, and the running total on the return is the exact sum of what has been refunded — never
	 * a recomputed guess.
	 *
	 * @param id The return being refunded.
	 * @param amount The amount to refund, as an exact decimal.
	 * @param reasonId The governed refund reason, when the operator picked one.
	 * @param note An operator note kept beside the refund.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The refund that was written.
	 * @throws BadRequestException when the return has not received anything yet, or when no payment
	 * capability is registered.
	 */
	public async refund(
		id: ID,
		amount: string | number,
		reasonId?: ID,
		note?: string,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<IRefundResult> {
		const settled = await this.settleRefund(id, amount, reasonId, note, expectation);

		return settled.refund;
	}

	/**
	 * Issues a refund and reports the version its write left behind.
	 *
	 * The amount is normalised at the currency's scale through the platform money layer before it is
	 * recorded, and the running total on the return is the exact sum of what has been refunded — never
	 * a recomputed guess. The version is answered as well as the refund because a receipt that refunds
	 * writes the return a second time in the same request, and the second write needs the version the
	 * first one left rather than the one the caller stated.
	 *
	 * @param id The return being refunded.
	 * @param amount The amount to refund, as an exact decimal.
	 * @param reasonId The governed refund reason, when the operator picked one.
	 * @param note An operator note kept beside the refund.
	 * @param expectation The version this write is predicated on.
	 * @returns The refund that was written, and the version the return now holds.
	 * @throws BadRequestException when the return has not received anything yet, or when no payment
	 * capability is registered.
	 */
	private async settleRefund(
		id: ID,
		amount: string | number,
		reasonId: ID | undefined,
		note: string | undefined,
		expectation: IVersionExpectation
	): Promise<{ refund: IRefundResult; version: number }> {
		const orderReturn = await this.findOneScoped(id);

		if (
			![
				OrderReturnStatus.RECEIVED,
				OrderReturnStatus.PARTIALLY_RECEIVED,
				OrderReturnStatus.CLOSED
			].includes(orderReturn.status)
		) {
			throw new BadRequestException(
				`A return in status "${orderReturn.status}" cannot be refunded: nothing has been received against it.`
			);
		}

		if (!this.refundGateway) {
			throw new BadRequestException(
				'RETURN_REFUND_UNAVAILABLE: the payment capability is not registered, so the refund cannot be issued.'
			);
		}

		const refundable = Money.of(String(amount), orderReturn.currency).round();

		if (!refundable.isPositive()) {
			throw new BadRequestException('A refund must be for a positive amount.');
		}

		const result = await this.refundGateway.createRefund({
			orderId: orderReturn.orderId,
			returnId: orderReturn.id,
			amount: refundable.toStorageString(),
			currency: orderReturn.currency,
			reasonId,
			note
		});

		const runningTotal = Money.of(orderReturn.refundAmount ?? '0', orderReturn.currency)
			.add(Money.of(result.amount, result.currency))
			.round()
			.toStorageString();

		const version = await this.commitHeader(orderReturn, { refundAmount: runningTotal }, expectation, {
			name: RETURN_EVENTS.REFUNDED,
			data: { refundedAmount: result.amount, refundId: result.refundId ?? null }
		});

		// The refund is on the order's ledger now, and the order's totals, its payment status and its
		// summary row are all derived from that ledger — so they are refreshed before this returns.
		await this.refreshOrderTotals(orderReturn.orderId);

		return { refund: result, version };
	}

	/**
	 * Refreshes the order columns the refund just moved.
	 *
	 * A refund appends an `order_transaction` and moves the payment's refunded total with it, and every
	 * derived figure on the order — `paidTotal`, `refundedTotal`, `outstandingTotal`, `paymentStatus` and
	 * the `order_summary` row that describes the version — is computed from that ledger by the one
	 * function the order package owns. ADR-26 requires the move that changed the ledger to recompute
	 * them, and this is that call: without it the order keeps answering the totals it held before the
	 * money went back, which is a customer shown as owing an amount that was already returned to them.
	 *
	 * **It is the same transaction only in intention, and the gap is stated rather than hidden.** The
	 * order package's `recompute` accepts no entity manager and writes through its own injected
	 * repositories, so it cannot join a transaction opened here — and this package opens none either:
	 * every write in it is its own auto-committed conditional update, and the gateway call that recorded
	 * the refund committed before this line runs. What would close it is an optional manager threaded
	 * through `recompute`, its summary write and its outbox append; that is a change to
	 * `packages/plugins/order/`, which this wave must not make. Until then the derived columns are
	 * refreshed immediately after the money rather than with it, and the window between the two is
	 * exactly the drift the daily `order-status-reconcile` job of doc 10 §5.4 re-derives and reports.
	 *
	 * **A failure here is deliberately not reported to the caller.** The refund has already been
	 * recorded and the provider has already been asked for the money by the time this runs, so an
	 * exception would answer a refund that happened as a refund that did not — and the refund route
	 * carries no retry key, so the caller's retry would issue it a second time. Stale derived columns
	 * that the reconciliation job finds are the smaller error, and they are the one this method chooses.
	 *
	 * The same holds for the receipt that calls it with `RETURN_RECEIVED`: the goods are in the
	 * warehouse and the movements are posted, so a failure to refresh what describes them is not
	 * answered as a failure of the receipt.
	 *
	 * @param orderId The order whose ledger moved.
	 * @param reason Why the ledger moved, recorded on the summary row the recompute writes.
	 */
	private async refreshOrderTotals(orderId?: ID, reason: string = RETURNS_TOTALS_REASON): Promise<void> {
		if (!this.orderTotals || !orderId) {
			return;
		}

		try {
			await this.orderTotals.recompute(orderId, reason);
		} catch {
			// Argued above: the ledger has moved, so a failure to refresh what describes it is not
			// answered as a failure of the move. The order package's reconciliation job re-derives it.
		}
	}

	/**
	 * Closes a return, which is the state that says nothing further can happen to it.
	 *
	 * There are two closures, and which one this is depends on what the lines say.
	 *
	 * - **Settled.** Every line is fully accounted for — what was received plus what arrived damaged
	 *   is what was requested — so the return is closed on its goods.
	 * - **Short.** A `PARTIALLY_RECEIVED` return whose goods will never all arrive is closed short,
	 *   which is the documented end of that state (doc 10 §11.1:
	 *   `PARTIALLY_RECEIVED --> CLOSED : short close after the receive window`). The outstanding
	 *   quantity is written onto the return's own `metadata.shortClose` — per line and in total —
	 *   rather than left to be inferred from the difference between two columns, so a return closed
	 *   with goods outstanding says so, and no remainder is abandoned silently. Nothing moves in
	 *   stock: only the received units were ever posted (doc 10 §11.7, `CLOSED` is "unchanged since
	 *   receipt").
	 *
	 * **Neither closure moves the order's requested-return counter, a short one included.** The
	 * remainder a short close leaves unreceived is recorded, not released: doc 10 §11.7 has `CLOSED`
	 * change nothing on the order, a `CLOSED` return is one of the live statuses this package's own
	 * ceiling check still counts in full (so the same units cannot be asked back by a second return),
	 * and the counter is the cache of "the non-rejected return lines". Releasing the remainder would
	 * leave the order saying those units are free to return while this package refuses a return of
	 * them. Only a rejection or a cancellation — the two withdrawals — gives them back.
	 *
	 * A header that claims `RECEIVED` while one of its lines still owes units contradicts itself, and
	 * that is refused rather than closed short: `RECEIVED` is the claim that everything arrived, so a
	 * return may not close on a claim its own lines deny. The short close belongs to the state that
	 * admits the shortfall.
	 *
	 * @param id The return to close.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The closed return.
	 */
	public async close(id: ID, expectation: IVersionExpectation = ANY_VERSION): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		if (orderReturn.status === OrderReturnStatus.CLOSED) {
			return orderReturn;
		}

		this.assertStatus(
			orderReturn,
			[OrderReturnStatus.RECEIVED, OrderReturnStatus.PARTIALLY_RECEIVED],
			'close'
		);

		const lines = await this.lineService.findForReturn(id);
		const shortfalls = lines
			.map((line) => ({
				line,
				outstanding: this.outstandingOf(line.quantity, line.receivedQuantity, line.damagedQuantity)
			}))
			.filter((entry) => toQuantityUnits(entry.outstanding) > 0n);

		if (shortfalls.length && orderReturn.status === OrderReturnStatus.RECEIVED) {
			throw new BadRequestException(
				'This return still has lines that were not fully received; receive them or cancel the return before closing it.'
			);
		}

		const closedAt = new Date();

		await this.commitHeader(
			orderReturn,
			{
				status: OrderReturnStatus.CLOSED,
				closedAt,
				...(shortfalls.length
					? {
							metadata: {
								...(orderReturn.metadata ?? {}),
								shortClose: {
									closedAt: closedAt.toISOString(),
									outstandingQuantity: sumQuantities(shortfalls.map((entry) => entry.outstanding)),
									lines: shortfalls.map((entry) => ({
										returnLineId: entry.line.id,
										orderLineId: entry.line.orderLineId,
										outstandingQuantity: entry.outstanding
									}))
								}
							}
					  }
					: {})
			},
			expectation,
			{
				name: RETURN_EVENTS.CLOSED,
				data: {
					shortClosed: shortfalls.length > 0,
					outstandingQuantity: shortfalls.length
						? sumQuantities(shortfalls.map((entry) => entry.outstanding))
						: '0'
				}
			}
		);

		return await this.findOneScoped(id);
	}

	/**
	 * Creates the return leg: the shipment that brings the goods back.
	 *
	 * The parcel, the carrier and the label belong to the shipping capability, so this delegates and
	 * records the chosen option on the return.
	 *
	 * @param id The return to ship.
	 * @param options The shipping option, the collection location and an already-known tracking number.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns What the shipping capability created.
	 */
	public async createShipment(
		id: ID,
		options: { shippingOptionId?: ID; warehouseId?: ID; trackingNumber?: string } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<IReturnShipmentResult> {
		const orderReturn = await this.findOneScoped(id);

		if (orderReturn.status !== OrderReturnStatus.APPROVED) {
			throw new BadRequestException('A return must be approved before its goods can be shipped back.');
		}

		if (!this.shipmentGateway) {
			throw new BadRequestException(
				'RETURN_SHIPPING_UNAVAILABLE: the shipping capability is not registered, so no return leg can be created.'
			);
		}

		const result = await this.shipmentGateway.createReturnShipment({
			returnId: orderReturn.id,
			orderId: orderReturn.orderId,
			shippingOptionId: options.shippingOptionId ?? orderReturn.shippingOptionId,
			warehouseId: options.warehouseId ?? orderReturn.warehouseId,
			trackingNumber: options.trackingNumber
		});

		await this.commitHeader(
			orderReturn,
			{ shippingOptionId: options.shippingOptionId ?? orderReturn.shippingOptionId },
			expectation
		);

		return result;
	}

	/**
	 * Reads a return with everything a detail view shows.
	 *
	 * @param id The return to read.
	 * @returns The return, its lines and its governed reason.
	 */
	public async findOneDetailed(id: ID): Promise<OrderReturn> {
		const orderReturn = await this.typeOrmOrderReturnRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true, reason_: true, warehouse: true }
		});

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		return orderReturn;
	}

	/**
	 * Writes the header fields a caller edited, under the version that caller read.
	 *
	 * The edit route is the one place a caller changes a return's own fields rather than moving it
	 * through its lifecycle, and it writes through the same conditional update as every other write:
	 * the patch it is given lands if and only if the return still holds the version the caller stated.
	 * An empty patch is a legitimate call — the line set is part of the aggregate, and an edit that
	 * only rewrites it still moves the aggregate on, so a client holding the old tag cannot edit the
	 * same return a second time.
	 *
	 * @param id The return to write.
	 * @param entity The header fields to change, which may be none.
	 * @param expectation The version the caller read, when the route stated one.
	 * @returns The return as it now stands.
	 */
	public async applyVersionedUpdate(
		id: ID,
		entity: Partial<OrderReturn>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		await this.commitHeader(orderReturn, entity as Record<string, unknown>, expectation);

		return await this.findOneDetailed(id);
	}

	/**
	 * Commits one version-predicated write of a return's header.
	 *
	 * This is the only path a header is written through: `commitVersionedUpdate` states the check and
	 * the increment as one statement — `UPDATE … SET version = :next … WHERE id = :id AND version =
	 * :expected` — so there is no window between deciding and acting, and no read-then-write race to
	 * lose. The affected-row count is the whole answer, and the platform turns it into the caller's
	 * answer: one row means the write landed and the return is now at the next version, none means
	 * another writer moved the return on, or deleted it, and the conflict or the not-found follows from
	 * the row itself.
	 *
	 * The scope the write is confined to is stated here as well as by the service layer, because a write
	 * the platform makes on its own behalf — a receipt compensating itself — runs with no request behind
	 * it, and the row's own tenant and organization are then the only scope there is.
	 *
	 * **The move announces itself from inside this method, and that is deliberate.** A return is the
	 * point at which goods and money travel back, so every context downstream of it has to be told —
	 * and this is the one place that knows a move actually committed: the conditional update either
	 * returned a version or threw. An event appended by a caller afterwards would announce transitions
	 * the statement had declined, and an event published over a bus rather than written as a row beside
	 * the change would be lost by any crash between the two. A write that announces nothing — the edit
	 * route, the shipping-option record — states no event and appends no row.
	 *
	 * @param orderReturn The return as it was read, which supplies the id and the scope of the write.
	 * @param patch The columns to write. `version` is set by the conditional update and never stated.
	 * @param expectation The version the caller accepted, or `ANY_VERSION` for a write the platform
	 * made on its own behalf.
	 * @param event The fact this write announces, when it announces one.
	 * @param guard What else the write is told. `precondition` names columns the row must still hold for
	 * the write to land, beside its version — a withdrawal and a receipt each state the status they were
	 * decided from, so two withdrawals cannot both land and a receipt cannot land over a withdrawal. `onCommitted` is called the moment the conditional write returned,
	 * before the event is appended, so a caller that has to compensate knows whether this write is one of
	 * the steps to undo.
	 * @returns The version the return now holds.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the return moved on, or with
	 * `RESOURCE_NOT_FOUND` when it is gone.
	 */
	private async commitHeader(
		orderReturn: OrderReturn,
		patch: Record<string, unknown>,
		expectation: IVersionExpectation = ANY_VERSION,
		event?: { name: string; data?: Record<string, unknown> },
		guard: { precondition?: Record<string, unknown>; onCommitted?: (version: number) => void } = {}
	): Promise<number> {
		const { version } = await commitVersionedUpdate(this, {
			id: orderReturn.id,
			expectation,
			patch,
			where: {
				...(guard.precondition ?? {}),
				...(orderReturn.tenantId ? { tenantId: orderReturn.tenantId } : {}),
				...(orderReturn.organizationId ? { organizationId: orderReturn.organizationId } : {})
			}
		});

		guard.onCommitted?.(version);

		if (event) {
			await this.announce(event.name, { ...orderReturn, ...patch } as OrderReturn, version, event.data);
		}

		return version;
	}

	/**
	 * Appends one `return.*` event to the platform outbox.
	 *
	 * The append goes through the return repository's own entity manager — the manager the conditional
	 * update was written through — and only after that update returned. The projection carries what a
	 * consumer routes on: the return, the order it is against, where it is in its lifecycle, the money
	 * it has given back and the version the write landed on. It does not carry the row or its lines: a
	 * consumer that needs either reads them, and an event that shipped them would freeze their shape
	 * into every subscriber.
	 *
	 * @param name The event name.
	 * @param orderReturn The return as the move left it.
	 * @param version The version the conditional update produced.
	 * @param data What this particular move adds to the projection.
	 */
	private async announce(
		name: string,
		orderReturn: OrderReturn,
		version: number,
		data: Record<string, unknown> = {}
	): Promise<void> {
		await this.outbox.append(this.typeOrmOrderReturnRepository.manager, {
			name,
			aggregateType: RETURN_AGGREGATE_TYPE,
			aggregateId: orderReturn.id,
			data: {
				returnId: orderReturn.id,
				number: orderReturn.number ?? null,
				orderId: orderReturn.orderId ?? null,
				status: orderReturn.status,
				currency: orderReturn.currency ?? null,
				refundAmount: orderReturn.refundAmount ?? '0',
				version,
				...data
			},
			tenantId: orderReturn.tenantId,
			organizationId: orderReturn.organizationId
		});
	}

	/**
	 * Normalises an amount a caller stated onto the currency's scale.
	 *
	 * An amount of zero is a real amount, so the check is for "not stated" rather than for "falsy" — a
	 * return recorded with a zero refund is a different fact from a return whose refund is unknown.
	 *
	 * @param amount The stated amount, when one was.
	 * @param currency The currency it is expressed in.
	 * @returns The amount at the storage scale, or undefined when none was stated.
	 */
	private normalizeAmount(amount: string | number | undefined, currency: string): string | undefined {
		if (amount === undefined || amount === null || String(amount) === '') {
			return undefined;
		}

		return Money.of(String(amount), currency).round().toStorageString();
	}

	/**
	 * Allocates the next return number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws BadRequestException when the organization has no `RETURN` series, which is a
	 * configuration fault worth naming rather than a generic not-found.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(RETURN_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for returns (key "${RETURN_NUMBER_KEY}"), so a return number cannot be allocated.`
			);
		}
	}

	/**
	 * States the stock movements a receipt will produce, without writing any of them.
	 *
	 * Every unit **this delivery** brought produces exactly one movement, and which one depends on what
	 * happened to it: a restocked unit is a `RETURN` that lands on the level, a unit that came back
	 * unsellable is an **event-only** `WRITE_OFF`, and a unit that arrived broken is an **event-only**
	 * `DAMAGE`. The two latter kinds are stated with `eventOnly` because those units never entered the
	 * location's stock: they left the network on a sale and came back unsellable, so the row records what
	 * happened to them while the level — the number the platform sells against — keeps the quantity it
	 * had. What the line already held is subtracted first, because the ledger holds every arrival
	 * separately and a movement for a unit that was recorded by an earlier delivery would count it
	 * twice.
	 *
	 * Stating the movements before writing them is what lets a receipt that cannot be posted leave the
	 * return untouched: the ledger is reached only after every movement is known to be placeable.
	 *
	 * @param orderReturn The return being received.
	 * @param plan The validated receipt.
	 * @param fulfilled The order's fulfilled lines, which name the variant each line is for.
	 * @param warehouseId The receiving location, when it was given on the request.
	 * @returns The movements the ledger will be asked for, in the order the lines state them.
	 * @throws BadRequestException when the variant or the location of a movement is unknown.
	 */
	private planMovements(
		orderReturn: OrderReturn,
		plan: IOrderReturnReceiptPlan[],
		fulfilled: Map<ID, { variantId?: ID }>,
		warehouseId?: ID
	): IPlannedMovement[] {
		const pending: Array<{
			line: OrderReturnLine;
			quantity: string;
			kind: StockMovementKind;
			eventOnly: boolean;
			reason: string;
		}> = [];

		for (const entry of plan) {
			const received = subtractQuantities(entry.receipt.receivedQuantity, entry.previous.receivedQuantity);
			const damaged = subtractQuantities(entry.receipt.damagedQuantity, entry.previous.damagedQuantity);
			const restock = entry.receipt.restock;

			if (toQuantityUnits(received) > 0n) {
				pending.push({
					line: entry.line,
					quantity: received,
					kind: restock ? StockMovementKind.RETURN : StockMovementKind.WRITE_OFF,
					// A restocked unit is on the shelf and moves the level; a unit nobody may sell is
					// recorded as the event it was.
					eventOnly: !restock,
					reason: restock
						? 'Returned goods went back into sellable stock.'
						: 'Returned goods were not restocked.'
				});
			}

			if (toQuantityUnits(damaged) > 0n) {
				pending.push({
					line: entry.line,
					quantity: damaged,
					kind: StockMovementKind.DAMAGE,
					// Damaged units are never sellable, so they are recorded without entering the level.
					eventOnly: true,
					reason: 'Returned goods arrived damaged.'
				});
			}
		}

		if (!pending.length) {
			return [];
		}

		const movements: IPlannedMovement[] = [];

		for (const movement of pending) {
			const warehouse = movement.line.warehouseId ?? warehouseId ?? orderReturn.warehouseId;
			const variantId = movement.line.orderLineId ? fulfilled.get(movement.line.orderLineId)?.variantId : undefined;

			if (!warehouse) {
				throw new BadRequestException(
					`Return line ${movement.line.id} has no receiving location, so its stock movement cannot be written.`
				);
			}

			if (!variantId) {
				throw new BadRequestException(
					`Return line ${movement.line.id} is not tied to a fulfilled variant, so its stock movement cannot be written.`
				);
			}

			movements.push({
				warehouseId: warehouse,
				variantId,
				quantity: movement.quantity,
				kind: movement.kind,
				eventOnly: movement.eventOnly,
				reason: movement.reason
			});
		}

		return movements;
	}

	/**
	 * Puts a receipt that could not be posted back the way it was found.
	 *
	 * Every way a receipt can fail ends here (doc 10 §11.6: "a failure in steps 2–3 compensates fully
	 * and the return stays `APPROVED`"), and it is what stops a return from claiming goods that never
	 * went back into stock:
	 *
	 * 1. the movements the ledger already accepted are reversed, because the goods they recorded are
	 *    not there;
	 * 2. the lines are put back to the quantities they held before the delivery, so the remainder a
	 *    later delivery would settle is still outstanding;
	 * 3. the order's received-return counter is moved back by the moves the order accepted;
	 * 4. the header is stated in the state it was read in, so a reader finds the return it had.
	 *
	 * This is a compensating action rather than a rollback: the rows live in three places — this plugin's
	 * tables, the order's lines and the ledger — and no transaction spans them, so the receipt is undone
	 * in the reverse of the order it was done in.
	 *
	 * **Only the steps that ran are undone.** Each step is read from what the receipt recorded as it went
	 * rather than from its plan: the order's counter is a relative move, and moving it back for a receipt
	 * that was refused before it reached the order subtracted units another return of the same line had
	 * put there — once for every retry of the refused request, until the floor refused the compensation
	 * and the failure was only logged. **Each step is attempted whatever the one before it did**, because a
	 * ledger that refuses a reversal is no reason to leave the lines and the order claiming the goods
	 * arrived; the failures are collected and raised together once every step was tried.
	 *
	 * @param orderReturn The return as it was read, which is the state the receipt is undone to.
	 * @param plan The receipt that was being written.
	 * @param steps What the receipt did before it failed.
	 * @throws Error naming every step whose undo failed, after all of them were attempted.
	 */
	private async compensateReceipt(
		orderReturn: OrderReturn,
		plan: IOrderReturnReceiptPlan[],
		steps: IReceiptSteps
	): Promise<void> {
		const failures: string[] = [];
		const attempt = async (step: string, undo: () => Promise<unknown>): Promise<void> => {
			try {
				await undo();
			} catch (error) {
				failures.push(`${step}: ${describe(error)}`);
			}
		};

		await attempt('stock movements', () => this.reverseMovements(orderReturn, steps.posted));

		if (steps.linesTouched) {
			await attempt('return lines', () => this.lineService.restoreReceipt(plan));
		}

		// The order's counter goes back with the lines it was moved for: it is the same step, so a
		// receipt that is undone must leave neither the return nor the order claiming the goods arrived —
		// and it goes back by what the order accepted, which is nothing when the receipt never reached it.
		await attempt('order counter', () =>
			this.lineService.restoreOrderLineReceipt(orderReturn.orderId, steps.orderLineMoves)
		);

		// **The header is restored only when the receipt's own header write landed.** It is the last
		// write of the receipt, so most failures happen before it — a movement the ledger refused, a
		// line the plan could not place, a version conflict on this very write — and restoring an
		// unchanged header anyway was a write that changed nothing and still moved the version on.
		// That turned every refused receipt into a conflict for the caller's retry: the client that
		// read version 2 and was refused found the return at 3, having been told nothing it could act
		// on. Whether the write landed is what the write itself recorded, not a comparison of the row
		// with the one the receipt read: a row another writer moved on reads as "moved" as well, and
		// restoring it would write this receipt's starting state over that writer's change. A header
		// that did land — the event after it threw — is restored under whatever version it holds at
		// this moment rather than the one the caller stated, because this write must land whether or
		// not the failed receipt moved the version on.
		await attempt('header', async () => {
			if (!steps.headerWritten) {
				return;
			}

			await this.commitHeader(orderReturn, {
				status: orderReturn.status,
				receivedAt: orderReturn.receivedAt,
				warehouseId: orderReturn.warehouseId,
				note: orderReturn.note
			});
		});

		if (failures.length) {
			throw new Error(failures.join('; '));
		}
	}

	/**
	 * Asks the ledger for one movement.
	 *
	 * @param orderReturn The return the movement belongs to.
	 * @param movement The planned movement.
	 * @returns The movement as the ledger recorded it.
	 * @throws BadRequestException when the inventory capability is not registered, because a receipt
	 * whose goods never became sellable is worse than a receipt that did not happen.
	 */
	private async postMovement(orderReturn: OrderReturn, movement: IPlannedMovement): Promise<IPostedMovement> {
		const result = await this.requireLedger().recordMovement({
			warehouseId: movement.warehouseId,
			variantId: movement.variantId,
			quantity: movement.quantity,
			kind: movement.kind,
			eventOnly: movement.eventOnly,
			referenceType: 'ORDER_RETURN',
			referenceId: orderReturn.id,
			reason: movement.reason
		});

		return { ...movement, movementId: result?.movementId };
	}

	/**
	 * Reverses the movements a receipt managed to post before it failed.
	 *
	 * The ledger is asked for the opposite delta rather than the row being deleted, because the ledger
	 * records what happened: a movement that was written and reversed is a different fact from one that
	 * was never written, and only the first is true. The reason names the reversal so the pair reads as
	 * one compensated receipt (doc 10 §11.6 step 3).
	 *
	 * @param orderReturn The return the movements belong to.
	 * @param posted The movements the ledger accepted.
	 */
	private async reverseMovements(orderReturn: OrderReturn, posted: IPostedMovement[]): Promise<void> {
		const ledger = this.stockLedger;

		if (!ledger || !posted.length) {
			return;
		}

		for (const movement of posted) {
			await ledger.recordMovement({
				warehouseId: movement.warehouseId,
				variantId: movement.variantId,
				quantity: fromQuantityUnits(-toQuantityUnits(movement.quantity)),
				kind: movement.kind,
				// The reversal of an event is an event: negating a movement that never entered the level
				// and letting the delta land would add units the ledger never had.
				eventOnly: movement.eventOnly,
				referenceType: 'ORDER_RETURN',
				referenceId: orderReturn.id,
				reason: `RECEIVE_COMPENSATED: ${movement.reason}`
			});
		}
	}

	/**
	 * @returns The stock ledger, which a receipt with something to move cannot do without.
	 * @throws BadRequestException when the inventory capability is not registered.
	 */
	private requireLedger(): IStockLedgerPort {
		if (!this.stockLedger) {
			throw new BadRequestException(
				'RETURN_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so returned goods cannot be written back to stock.'
			);
		}

		return this.stockLedger;
	}

	/**
	 * @param plan The receipt as it will be written.
	 * @returns The received and outstanding quantities of the whole return, as exact decimals, once
	 * every line of the plan holds what this delivery leaves on it.
	 */
	private summarize(plan: IOrderReturnReceiptPlan[]): { received: string; outstanding: string } {
		let received = '0';
		let outstanding = '0';

		for (const entry of plan) {
			const settled = sumQuantities([entry.receipt.receivedQuantity, entry.receipt.damagedQuantity]);

			received = sumQuantities([received, settled]);
			outstanding = sumQuantities([
				outstanding,
				this.outstandingOf(entry.line.quantity, entry.receipt.receivedQuantity, entry.receipt.damagedQuantity)
			]);
		}

		return { received, outstanding };
	}

	/**
	 * @param quantity What the line was requested for.
	 * @param received What arrived sound.
	 * @param damaged What arrived broken; it counts against the request exactly like a sound unit.
	 * @returns What the line still owes against its request, clamped at zero.
	 */
	private outstandingOf(
		quantity: string | number | null | undefined,
		received: string | number | null | undefined,
		damaged: string | number | null | undefined
	): string {
		const settled = sumQuantities([received, damaged]);

		return toQuantityUnits(settled) > toQuantityUnits(quantity) ? '0' : subtractQuantities(quantity, settled);
	}

	/**
	 * @param id The return to read.
	 * @returns The return, when it belongs to the caller's tenant and organization.
	 * @throws NotFoundException when it does not.
	 */
	private async findOneScoped(id: ID): Promise<OrderReturn> {
		const orderReturn = await this.readScoped(id);

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		return orderReturn;
	}

	/**
	 * Reads a return in the caller's tenant and organization, through the configured ORM.
	 *
	 * Under `DB_ORM=mikro-orm` the TypeORM entity carries its base columns and nothing else —
	 * `@MultiORMColumn` registers the active ORM's decorator alone — so a read through the TypeORM
	 * repository answers a return with no status, no order and no tenant. On that ORM the platform's own read
	 * is used, which also lifts MikroORM's soft-delete filter when a retired return is asked for.
	 *
	 * @param id The return to read.
	 * @param withDeleted Whether a retired return is read too, which is what a restoration reads.
	 * @returns The return, or null when it is not the caller's.
	 */
	private async readScoped(id: ID, withDeleted = false): Promise<OrderReturn | null> {
		const scope = {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};

		if (this.ormType === MultiORMEnum.MikroORM) {
			try {
				return await this.findOneByIdString(id, {
					where: scope,
					...(withDeleted ? { withDeleted: true } : {})
				});
			} catch (error) {
				if (error instanceof NotFoundException) {
					return null;
				}

				throw error;
			}
		}

		return await this.typeOrmOrderReturnRepository.findOne({
			where: { id, ...scope },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * @param orderReturn The return the transition is attempted on.
	 * @param allowed The statuses it may be attempted from.
	 * @param action The action being attempted, named in the error.
	 * @throws BadRequestException when the return is not in one of the allowed statuses.
	 */
	private assertStatus(orderReturn: OrderReturn, allowed: OrderReturnStatus[], action: string): void {
		if (!allowed.includes(orderReturn.status)) {
			throw new BadRequestException(
				`A return in status "${orderReturn.status}" cannot ${action}; expected ${allowed.join(' or ')}.`
			);
		}
	}
}

/**
 * @param error The failure.
 * @returns The failure as one line, so a log entry stays an entry.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
