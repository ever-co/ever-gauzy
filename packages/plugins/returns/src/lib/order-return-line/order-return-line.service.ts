import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In, Not, SaveOptions } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { LegacyFindOneOptions, MultiORMEnum, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	IOrderFulfillmentPort,
	IOrderLineFulfillment,
	IOrderLineReceiptMove,
	IOrderLineReturnRequestMove,
	IOrderReturnLineInput,
	IOrderReturnReceiptInput,
	OrderReturnStatus,
	RETURNS_ORDER_FULFILLMENT
} from '../returns.types';
import { fromQuantityUnits, normalizeQuantity, sumQuantities, toQuantityUnits } from '../returns.quantity';
import { OrderReturn } from '../order-return/order-return.entity';
import { TypeOrmOrderReturnRepository } from '../order-return/repository/type-orm-order-return.repository';
import { OrderReturnLine } from './order-return-line.entity';
import { MikroOrmOrderReturnLineRepository } from './repository/mikro-orm-order-return-line.repository';
import { TypeOrmOrderReturnLineRepository } from './repository/type-orm-order-return-line.repository';
/** The return statuses in which its line set may still be written. */
const EDITABLE_STATUSES: OrderReturnStatus[] = [OrderReturnStatus.OPEN, OrderReturnStatus.REQUESTED];

/**
 * What one line of a return holds once a delivery is written, and what it held before it.
 *
 * The pair is what makes a receipt reversible: the quantities it will write are stated before the
 * first row changes, so a receipt whose stock movements are refused can be put back to `previous`
 * instead of leaving the return claiming goods it never took back.
 */
export interface IOrderReturnReceiptPlan {
	/** The line this delivery is against. */
	line: OrderReturnLine;
	/** What the line holds once this delivery is written: every delivery so far, not only this one. */
	receipt: { receivedQuantity: DecimalString; damagedQuantity: DecimalString; restock: boolean };
	/** What the line held before it, so a receipt that is not written can be undone. */
	previous: { receivedQuantity: DecimalString; damagedQuantity: DecimalString; restock: boolean };
}

/**
 * The return statuses that still count against the order's fulfilled quantity.
 *
 * They are also the statuses whose outstanding units the order's requested-return counter holds: a return
 * leaves the set by being rejected or cancelled, and those two moves are what give its units back. So a
 * return, or a line of one, that is retired or removed while its return is in this set gives back what it
 * still asked for, and one that is restored into it asks for it again.
 */
export const LIVE_RETURN_STATUSES: OrderReturnStatus[] = [
	OrderReturnStatus.OPEN,
	OrderReturnStatus.REQUESTED,
	OrderReturnStatus.APPROVED,
	OrderReturnStatus.RECEIVED,
	OrderReturnStatus.PARTIALLY_RECEIVED,
	OrderReturnStatus.CLOSED
];

/**
 * The lines of a return, and the ceiling they are measured against.
 *
 * **The rule this service exists for:** a return may only cover what was actually fulfilled on the
 * order. Asking to return three of something that never shipped is not a validation detail — it is
 * the difference between a refund the tenant owes and one it does not — so the check is here, on the
 * only path that writes a return line, and it is exact: the quantities are compared as scaled
 * integers, never as floating point numbers.
 *
 * The second half of the rule is the aggregate. One order line can be returned more than once (a
 * partial return, then another), so what is checked is the sum of the quantities of every live
 * return on that line plus the request, against the fulfilled quantity — never the request alone.
 */
@Injectable()
export class OrderReturnLineService extends TenantAwareCrudService<OrderReturnLine> {
	/** Where a compensation that did not land — a failure that must not replace the original — is reported. */
	private readonly logger = new Logger(OrderReturnLineService.name);

	constructor(
		readonly typeOrmOrderReturnLineRepository: TypeOrmOrderReturnLineRepository,
		readonly mikroOrmOrderReturnLineRepository: MikroOrmOrderReturnLineRepository,
		readonly typeOrmOrderReturnRepository: TypeOrmOrderReturnRepository,
		@Optional()
		@Inject(RETURNS_ORDER_FULFILLMENT)
		private readonly fulfillment?: IOrderFulfillmentPort
	) {
		super(typeOrmOrderReturnLineRepository, mikroOrmOrderReturnLineRepository);
	}

	/**
	 * Reads the lines of a return, scoped to the caller's tenant and organization.
	 *
	 * The read goes through the configured ORM. Under `DB_ORM=mikro-orm` the TypeORM entity carries its
	 * base columns and nothing else — `@MultiORMColumn` registers the active ORM's decorator alone — so the
	 * TypeORM repository cannot filter on the return or answer a quantity there; the platform's own read,
	 * which lifts MikroORM's soft-delete filter for `withDeleted`, is used on that ORM instead. The order is
	 * total — the instant, then the identity — because `orderReturnLines` pages these rows with offset
	 * cursors, and two lines written in one clock tick would otherwise come back in either order.
	 *
	 * @param returnId The return to read.
	 * @param withDeleted Whether lines retired by a later replacement write are included. Stated through
	 * the find options rather than as a filter on the returned rows, because the store is what knows a
	 * row was retired.
	 * @returns The lines, oldest first.
	 */
	public async findForReturn(returnId: ID, withDeleted?: boolean): Promise<OrderReturnLine[]> {
		const where = {
			returnId,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};

		if (this.usesMikroOrm) {
			return await this.find({
				where,
				order: { createdAt: 'ASC', id: 'ASC' },
				...(withDeleted ? { withDeleted: true } : {})
			});
		}

		return await this.typeOrmOrderReturnLineRepository.find({
			where,
			order: { createdAt: 'ASC', id: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * Replaces the line set of a return that has not been received yet.
	 *
	 * Replacement rather than merge, because the ceiling check is an aggregate over the whole request:
	 * adding one line to a set that already exists has to be validated against the same total as the
	 * original request was, and merging would make the two paths diverge. Lines that were never
	 * received are soft-deleted, so the partial unique index on the pair keeps working.
	 *
	 * **The order is told what is now asked back, before the lines are written.** Each order line's
	 * `returnRequestedQuantity` is moved by the difference between what the new set asks for and what the
	 * set it replaces asked for — the whole request on a return's first write, the edit on a later one —
	 * which is what keeps doc 10 invariant I-12 (`returnReceivedQuantity + returnDismissedQuantity <=
	 * returnRequestedQuantity`) true of the order: nothing in the returns flow wrote the counter, so the
	 * invariant compared the goods that came back against a zero. The move comes first so a move the
	 * order refuses leaves the line set untouched, and a line write that fails after it moves the counter
	 * back by exactly the moves that landed.
	 *
	 * @param returnId The return to write the lines of.
	 * @param inputs The requested lines.
	 * @returns The written lines.
	 * @throws BadRequestException when the return is not editable or the request exceeds the ceiling.
	 */
	public async replaceLines(returnId: ID, inputs: IOrderReturnLineInput[]): Promise<OrderReturnLine[]> {
		const orderReturn = await this.readReturn(returnId);

		if (!EDITABLE_STATUSES.includes(orderReturn.status)) {
			throw new BadRequestException(
				`The lines of a return in status "${orderReturn.status}" cannot be changed; only an open or requested return can be edited.`
			);
		}

		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('A return needs at least one line.');
		}

		await this.assertReturnable(orderReturn.orderId, inputs, returnId);

		const requested = await this.moveOrderLineRequest(
			orderReturn.orderId,
			this.requestMoves(await this.findForReturn(returnId), inputs)
		);

		try {
			return await this.writeLines(orderReturn, inputs);
		} catch (error) {
			try {
				await this.restoreOrderLineRequest(orderReturn.orderId, requested);
			} catch (compensationError) {
				this.logger.error(
					`The lines of return ${returnId} could not be written and the order's requested counter could ` +
						`not be moved back: ${describe(compensationError)}`
				);
			}

			throw error;
		}
	}

	/**
	 * Writes a validated line set in place of the one a return holds.
	 *
	 * @param orderReturn The return, which supplies the id and the tenancy the lines are written with.
	 * @param inputs The requested lines, already measured against the ceiling.
	 * @returns The written lines.
	 */
	private async writeLines(orderReturn: OrderReturn, inputs: IOrderReturnLineInput[]): Promise<OrderReturnLine[]> {
		const returnId = orderReturn.id;

		await this.typeOrmOrderReturnLineRepository.softDelete({ returnId });

		const lines: OrderReturnLine[] = [];

		for (const input of inputs) {
			lines.push(
				await super.create({
					returnId,
					orderLineId: input.orderLineId,
					quantity: normalizeQuantity(input.quantity),
					receivedQuantity: '0',
					damagedQuantity: '0',
					restock: input.restock ?? true,
					reasonId: input.reasonId,
					warehouseId: input.warehouseId,
					note: input.note,
					// **The tenancy is the header's, and it has to be stated.**
					// `TenantAwareCrudService.create` stamps the tenant from the request and states no
					// organization at all, so a line written without one carries `organizationId = NULL`
					// while every scoped read of these lines — `findForReturn` below, `sumClaimedQuantities`
					// and the ceiling check built on it — filters by the caller's organization. A line the
					// service cannot read back is a receipt that cannot find its own lines ("Return line …
					// does not belong to this return", for a line that does) and a ceiling that counts
					// nothing, so the same fulfilled units can be claimed twice. It is read from the header
					// rather than from the request because that is the row the line belongs to.
					tenantId: orderReturn.tenantId,
					organizationId: orderReturn.organizationId
				} as any)
			);
		}

		return lines;
	}

	/**
	 * Checks a requested line set against what was fulfilled on the order and what other live returns
	 * already claim.
	 *
	 * @param orderId The order the return is against.
	 * @param requested The requested lines.
	 * @param excludeReturnId The return being edited, whose own lines are not counted against it.
	 * @returns The fulfilled quantities the request was checked against, keyed by order line.
	 * @throws BadRequestException when a line was never fulfilled, or when the request would exceed
	 * the fulfilled quantity.
	 */
	public async assertReturnable(
		orderId: ID,
		requested: Array<{ orderLineId: ID; quantity: DecimalString | number }>,
		excludeReturnId?: ID
	): Promise<Map<ID, IOrderLineFulfillment>> {
		if (!orderId) {
			throw new BadRequestException('A return must name the order it is against.');
		}

		const fulfilled = await this.readFulfilledLines(orderId);
		const orderLineIds = requested.map((line) => line.orderLineId).filter((id) => !!id);

		if (orderLineIds.length !== requested.length) {
			throw new BadRequestException('Every return line must name the order line it returns.');
		}

		const claimed = await this.sumClaimedQuantities(orderId, orderLineIds, excludeReturnId);

		for (const line of requested) {
			const fulfilledLine = fulfilled.get(line.orderLineId);

			if (!fulfilledLine) {
				throw new BadRequestException(
					`Order line ${line.orderLineId} was not fulfilled on this order, so it cannot be returned.`
				);
			}

			const units = toQuantityUnits(line.quantity);

			if (units <= 0n) {
				throw new BadRequestException(
					`Order line ${line.orderLineId} is being returned with a non-positive quantity.`
				);
			}

			const alreadyClaimed = claimed.get(line.orderLineId) ?? '0';
			const total = sumQuantities([alreadyClaimed, line.quantity]);

			if (toQuantityUnits(total) > toQuantityUnits(fulfilledLine.fulfilledQuantity)) {
				throw new BadRequestException(
					`Returning ${sumQuantities([alreadyClaimed, line.quantity])} of order line ${line.orderLineId} ` +
						`would exceed the ${fulfilledLine.fulfilledQuantity} that was fulfilled on this order.`
				);
			}
		}

		return fulfilled;
	}

	/**
	 * The fulfilled quantities of an order, as the order domain reports them.
	 *
	 * @param orderId The order to read.
	 * @returns The fulfilled lines, keyed by order line.
	 * @throws BadRequestException when no order capability is registered: without it there is no
	 * ceiling, and a return that cannot be measured against what shipped must not be accepted.
	 */
	public async readFulfilledLines(orderId: ID): Promise<Map<ID, IOrderLineFulfillment>> {
		if (!this.fulfillment) {
			throw new BadRequestException(
				'RETURN_FULFILLMENT_UNAVAILABLE: the order capability is not registered, so the fulfilled quantity of an order cannot be read and a return cannot be validated against it.'
			);
		}

		const lines = await this.fulfillment.getFulfilledLines(orderId);
		const fulfilled = new Map<ID, IOrderLineFulfillment>();

		for (const line of lines ?? []) {
			if (line?.orderLineId) {
				fulfilled.set(line.orderLineId, line);
			}
		}

		return fulfilled;
	}

	/**
	 * Sums what every live return of the order already claims for each order line.
	 *
	 * Both reads go through the configured ORM, for the reason {@link findForReturn} states: the ceiling is
	 * checked on every request, edit and restoration of a return, and a read through the TypeORM repository
	 * under MikroORM would count nothing.
	 *
	 * @param orderId The order the returns are against.
	 * @param orderLineIds The order lines to total.
	 * @param excludeReturnId A return to leave out of the total, when it is the one being edited.
	 * @returns The claimed quantity per order line.
	 */
	public async sumClaimedQuantities(
		orderId: ID,
		orderLineIds: ID[],
		excludeReturnId?: ID
	): Promise<Map<ID, DecimalString>> {
		const claimed = new Map<ID, DecimalString>();

		for (const orderLineId of orderLineIds) {
			claimed.set(orderLineId, '0');
		}

		if (!orderLineIds.length) {
			return claimed;
		}

		const scope = {
			orderId,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
		const liveReturns: Array<Pick<OrderReturn, 'id'>> = this.usesMikroOrm
			? await this.mikroOrmOrderReturnLineRepository.getEntityManager().find(
					OrderReturn,
					{ ...scope, status: { $in: LIVE_RETURN_STATUSES } } as never,
					{
						fields: ['id']
					} as never
				)
			: await this.typeOrmOrderReturnRepository.find({
					where: { ...scope, status: In(LIVE_RETURN_STATUSES) },
					select: { id: true }
				});

		const returnIds = liveReturns.map((row) => row.id).filter((id) => !!id && id !== excludeReturnId);

		if (!returnIds.length) {
			return claimed;
		}

		const lineCriteria = { returnId: In(returnIds), orderLineId: In(orderLineIds) };
		const lines = this.usesMikroOrm
			? await this.find({ where: lineCriteria })
			: await this.typeOrmOrderReturnLineRepository.find({ where: lineCriteria });

		for (const line of lines) {
			if (!line.orderLineId) {
				continue;
			}

			claimed.set(line.orderLineId, sumQuantities([claimed.get(line.orderLineId) ?? '0', line.quantity]));
		}

		return claimed;
	}

	/**
	 * Validates a receipt and states what each line will hold, without writing anything.
	 *
	 * Separated from the write so a whole receipt — the quantities it moves and the stock movements it
	 * will ask the ledger for — can be validated before the first row changes. A receipt that cannot be
	 * posted has to leave the return exactly as it was (doc 10 §11.6, the failure semantics of steps
	 * 2–3), and validation that happened after the write could not promise that.
	 *
	 * **The quantities accumulate.** One return arrives over as many deliveries as the customer sends,
	 * so a second delivery is added to the first rather than replacing it: overwriting would make the
	 * remainder of a partly received return unclaimable, and the return could never reach `RECEIVED`
	 * (doc 10 §11.1, `PARTIALLY_RECEIVED --> RECEIVED`).
	 *
	 * @param returnId The return being received.
	 * @param inputs The quantities that arrived, per line.
	 * @returns The lines with what they will hold and what they held, in the order the caller stated.
	 * @throws NotFoundException when a line does not belong to the return.
	 * @throws BadRequestException when a delivery carries nothing, or when the deliveries together
	 * would exceed what the line was requested for.
	 */
	public async planReceipt(returnId: ID, inputs: IOrderReturnReceiptInput[]): Promise<IOrderReturnReceiptPlan[]> {
		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('Receiving a return needs at least one line.');
		}

		const lines = await this.findForReturn(returnId);
		const byId = new Map<ID, OrderReturnLine>(lines.map((line) => [line.id, line]));
		const plan: IOrderReturnReceiptPlan[] = [];

		for (const input of inputs) {
			const line = byId.get(input.lineId);

			if (!line) {
				throw new NotFoundException(`Return line ${input.lineId} does not belong to this return.`);
			}

			const arrived = normalizeQuantity(input.receivedQuantity);
			const broken = normalizeQuantity(input.damagedQuantity ?? 0);
			const delivered = sumQuantities([arrived, broken]);

			if (toQuantityUnits(delivered) <= 0n) {
				throw new BadRequestException(`Return line ${input.lineId} was received with no quantity at all.`);
			}

			// What the line holds once this delivery is added, measured against what was asked for:
			// damaged units count exactly like sound ones, because an item that arrived broken arrived.
			const held = sumQuantities([line.receivedQuantity, line.damagedQuantity, delivered]);

			if (toQuantityUnits(held) > toQuantityUnits(line.quantity)) {
				throw new BadRequestException(
					`Return line ${input.lineId} was requested for ${line.quantity} but ${held} was received.`
				);
			}

			plan.push({
				line,
				receipt: {
					receivedQuantity: sumQuantities([line.receivedQuantity, arrived]),
					damagedQuantity: sumQuantities([line.damagedQuantity, broken]),
					restock: input.restock ?? line.restock
				},
				previous: {
					receivedQuantity: line.receivedQuantity,
					damagedQuantity: line.damagedQuantity,
					restock: line.restock
				}
			});
		}

		return plan;
	}

	/**
	 * Writes the quantities a receipt planned.
	 *
	 * @param plan The validated receipt.
	 * @returns The written lines.
	 */
	public async applyReceipt(plan: IOrderReturnReceiptPlan[]): Promise<OrderReturnLine[]> {
		return await this.writeReceipt(plan, 'receipt');
	}

	/**
	 * Puts the lines back to what they held before a receipt.
	 *
	 * This is the compensation the receive operation needs when the stock movements behind a receipt
	 * are refused after the lines were written: the goods did not go back on the shelf, so the return
	 * must not say they arrived (doc 10 §11.6: "a failure in steps 2–3 compensates fully and the
	 * return stays `APPROVED`").
	 *
	 * @param plan The receipt being undone.
	 * @returns The restored lines.
	 */
	public async restoreReceipt(plan: IOrderReturnReceiptPlan[]): Promise<OrderReturnLine[]> {
		return await this.writeReceipt(plan, 'previous');
	}

	/**
	 * Moves the order's received-return counter by the units a receipt brought.
	 *
	 * **The order has to be told, and this is the only place that knows by how much.** An order line's
	 * `returnReceivedQuantity` is the order's own cache of what came back — `deriveFulfillmentStatus`
	 * sums it, which is what makes `PARTIALLY_RETURNED` and `RETURNED` reachable at all — and the
	 * delta is this package's fact: the return line already held what earlier deliveries recorded, so
	 * the difference between what the receipt states and what it replaces is exactly what this
	 * delivery added. The call travels through the fulfillment port, the seam that exists so that no
	 * other package reads or writes `order_line`.
	 *
	 * **A damaged unit is a unit that came back, and it moves the same counter.** The receipt counts it
	 * against the request ("an item that arrived broken arrived") and the return reaches `RECEIVED` on it,
	 * so the order is told about it too: moving only the sound units left a return of one sound and one
	 * broken unit `RECEIVED` while its order answered `PARTIALLY_RETURNED`, and a delivery that was all
	 * broken moved nothing at all. It is `returnReceivedQuantity` rather than `returnDismissedQuantity`
	 * because of what each is read as. `deriveFulfillmentStatus` reads the received counter as "came back"
	 * and subtracts the dismissed one from what the order still owes — which answers `FULFILLED` for an
	 * order whose every unit came back broken — and the fulfilment package subtracts the dismissed one from
	 * what a line may still ship, so a broken return of a partly shipped line would cancel units the
	 * customer is still owed.
	 *
	 * It is called beside `applyReceipt` inside the receipt's own attempt, because doc 10 §11.6 puts
	 * it in step 2 (`receive-lines`: "order line `returnReceivedQuantity` updated") and because a
	 * failure after it must be undone by the same compensation the lines get.
	 *
	 * @param orderId The order whose line counters move.
	 * @param plan The validated receipt.
	 * @returns The moves the order accepted, which are exactly what {@link restoreOrderLineReceipt} undoes.
	 * The port is all or nothing, so a call that throws moved nothing.
	 */
	public async applyOrderLineReceipt(
		orderId: ID,
		plan: readonly IOrderReturnReceiptPlan[]
	): Promise<IOrderLineReceiptMove[]> {
		const moves = this.receiptMoves(plan);

		if (moves.length === 0) {
			return [];
		}

		await this.requireFulfillment('the quantities that arrived cannot be recorded against the order').recordReturnReceipt(
			orderId,
			moves
		);

		return moves;
	}

	/**
	 * Moves the order's received-return counter back by the moves a receipt applied.
	 *
	 * The mirror of {@link applyOrderLineReceipt}, and the same call with the sign reversed: the
	 * counter is a move rather than a value, so undoing one is moving it back. **It is given the moves
	 * that landed rather than the plan**, because the plan says what the receipt meant to do: a receipt
	 * refused before its counter move — a line with no receiving location, a movement the ledger refused
	 * before the order was told — moved nothing, and reversing its plan subtracted units another return
	 * had put there.
	 *
	 * @param orderId The order whose line counters move.
	 * @param applied The moves {@link applyOrderLineReceipt} answered; an empty list moves nothing.
	 */
	public async restoreOrderLineReceipt(orderId: ID, applied: readonly IOrderLineReceiptMove[]): Promise<void> {
		if (!applied.length) {
			return;
		}

		await this.requireFulfillment('the receipt cannot be taken back from the order').recordReturnReceipt(
			orderId,
			negateMoves(applied)
		);
	}

	/**
	 * States one receipt's effect on the order's received-return counter.
	 *
	 * A line the receipt did not move is left out rather than sent as a zero: the order package reads
	 * every entry as a write, and a delta of nothing would be a write that changes nothing on a row a
	 * concurrent delivery may be holding.
	 *
	 * @param plan The receipt.
	 * @returns One move per order line this delivery brought units of, sound and damaged together.
	 * @throws BadRequestException when a line whose quantity moved names no order line — a receipt the
	 * order cannot be told about would leave the order answering a fulfilment status the goods in its own
	 * warehouse deny.
	 */
	private receiptMoves(plan: readonly IOrderReturnReceiptPlan[]): IOrderLineReceiptMove[] {
		const moves: IOrderLineReceiptMove[] = [];

		for (const entry of plan) {
			const units =
				toQuantityUnits(entry.receipt.receivedQuantity) +
				toQuantityUnits(entry.receipt.damagedQuantity) -
				toQuantityUnits(entry.previous.receivedQuantity) -
				toQuantityUnits(entry.previous.damagedQuantity);

			if (units === 0n) {
				continue;
			}

			if (!entry.line.orderLineId) {
				throw new BadRequestException(
					`RETURN_ORDER_LINE_UNLINKED: return line ${entry.line.id} received ${fromQuantityUnits(units)} unit(s) ` +
						'and names no order line, so what arrived cannot be recorded against the order.'
				);
			}

			moves.push({ orderLineId: entry.line.orderLineId, quantityDelta: fromQuantityUnits(units) });
		}

		return moves;
	}

	/**
	 * States what a rewrite of a return's line set changes in what is asked back, per order line.
	 *
	 * @param current The lines the return holds before the rewrite; a return's first write holds none.
	 * @param inputs The lines it will hold.
	 * @returns One move per order line whose requested quantity changed, never a zero.
	 */
	private requestMoves(
		current: readonly OrderReturnLine[],
		inputs: readonly IOrderReturnLineInput[]
	): IOrderLineReturnRequestMove[] {
		const units = new Map<ID, bigint>();

		for (const line of current) {
			if (line.orderLineId) {
				units.set(line.orderLineId, (units.get(line.orderLineId) ?? 0n) - toQuantityUnits(line.quantity));
			}
		}

		for (const input of inputs) {
			units.set(input.orderLineId, (units.get(input.orderLineId) ?? 0n) + toQuantityUnits(input.quantity));
		}

		return Array.from(units)
			.filter(([, delta]) => delta !== 0n)
			.map(([orderLineId, delta]) => ({ orderLineId, quantityDelta: fromQuantityUnits(delta) }));
	}

	/**
	 * Takes back from the order what a withdrawn return no longer asks for.
	 *
	 * A rejected or cancelled return no longer counts against the order (doc 10 §11.7:
	 * "returnRequestedQuantity reverted"), so each order line's requested counter is moved down by what
	 * the return's lines still had outstanding — requested, less what already arrived sound or damaged.
	 * A unit that arrived stays asked for: it is on the received counter, and I-12 bounds that counter by
	 * this one.
	 *
	 * @param returnId The return being withdrawn.
	 * @param orderId The order it is against.
	 * @returns The moves the order accepted, which are what {@link restoreOrderLineRequest} undoes when the
	 * withdrawal itself does not land.
	 */
	public async releaseOrderLineRequest(returnId: ID, orderId: ID): Promise<IOrderLineReturnRequestMove[]> {
		return await this.moveOrderLineRequest(orderId, outstandingMoves(await this.findForReturn(returnId), -1n));
	}

	/**
	 * Asks the order again for what a return that is live once more still asks for.
	 *
	 * The mirror of {@link releaseOrderLineRequest}, for a return that is restored after it was retired: the
	 * retirement gave its outstanding units back, so its restoration takes them again, line by line, by what
	 * each line still had outstanding. The caller measures the return against the fulfilled ceiling first —
	 * another return may have asked for the same units while this one was retired.
	 *
	 * @param returnId The return being restored.
	 * @param orderId The order it is against.
	 * @returns The moves the order accepted, which {@link restoreOrderLineRequest} undoes when the
	 * restoration itself does not land.
	 */
	public async reclaimOrderLineRequest(returnId: ID, orderId: ID): Promise<IOrderLineReturnRequestMove[]> {
		return await this.moveOrderLineRequest(orderId, outstandingMoves(await this.findForReturn(returnId), 1n));
	}

	/**
	 * Moves the order's requested-return counter back by the moves a write applied.
	 *
	 * @param orderId The order whose line counters move.
	 * @param applied The moves that landed; an empty list moves nothing.
	 */
	public async restoreOrderLineRequest(orderId: ID, applied: readonly IOrderLineReturnRequestMove[]): Promise<void> {
		if (!applied.length) {
			return;
		}

		await this.requireFulfillment('the request cannot be put back on the order').recordReturnRequest(
			orderId,
			negateMoves(applied)
		);
	}

	/**
	 * Retires one line recoverably, and gives back to the order what it still asked for.
	 *
	 * The route is the inherited `DELETE /order-return-lines/:id/soft` and the GraphQL
	 * `softDeleteOrderReturnLine` field, and both reach this method. A retired line leaves every read of its
	 * return and the fulfilled ceiling a new request is measured against, so while its return is live the
	 * order's requested counter would otherwise go on counting units nothing asks for (doc 10 I-12): its
	 * outstanding units are released first, exactly as a withdrawal releases them, and put back if the
	 * retirement does not land. A line of a return that no longer counts — rejected or cancelled, or itself
	 * retired — gave its units back already, and is retired as it always was.
	 *
	 * @param id The line to retire.
	 * @param options Find options the platform narrows its own read with, forwarded unchanged.
	 * @param saveOptions The platform's save options, forwarded unchanged.
	 * @returns The retired line.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async softRemove(
		id: ID,
		options?: LegacyFindOneOptions<OrderReturnLine>,
		saveOptions?: SaveOptions
	): Promise<OrderReturnLine> {
		const { line, orderReturn } = await this.readLive(id);

		if (!orderReturn) {
			return await super.softRemove(id, options, saveOptions);
		}

		return await this.whileMoved(orderReturn.orderId, outstandingMoves([line], -1n), () =>
			super.softRemove(id, options, saveOptions)
		);
	}

	/**
	 * Removes one line for good, and gives back to the order what it still asked for.
	 *
	 * The inherited `DELETE /order-return-lines/:id` reaches this method, for the reason and in the way
	 * {@link softRemove} states. A statement that removed nothing — the line was removed by another request
	 * in the meantime, which gave its units back itself — puts this call's release back. A line already
	 * retired gave its units back when it was, and is removed as it always was.
	 *
	 * @param criteria The line to remove, by its identifier. Conditions are handed to the platform as they
	 * always were.
	 * @param options Find options the platform merges into the statement, forwarded unchanged.
	 * @returns The delete result.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<OrderReturnLine>,
		options?: LegacyFindOneOptions<OrderReturnLine>
	): Promise<DeleteResult> {
		if (typeof criteria !== 'string') {
			return await super.delete(criteria, options);
		}

		// A retired line is read too: its retirement gave its units back already, and it is removed as it
		// always was.
		const { line, orderReturn } = await this.readLive(criteria, true);

		if (!orderReturn || line.deletedAt) {
			return await super.delete(criteria, options);
		}

		return await this.whileMoved(
			orderReturn.orderId,
			outstandingMoves([line], -1n),
			() => super.delete(criteria, options),
			(result) => Boolean(result?.affected)
		);
	}

	/**
	 * Restores a retired line, and asks the order again for what it still asks for.
	 *
	 * The route is the inherited `PUT /order-return-lines/:id/recover` and the GraphQL
	 * `recoverOrderReturnLine` field. When the line's return is live, the restored line counts against the
	 * order again, so it is measured against the fulfilled ceiling with the rest of its return first —
	 * another return may have asked for the same units while this line was retired — and its outstanding
	 * units are asked for before it is restored, and given back if the restoration does not land.
	 *
	 * @param id The line to restore.
	 * @param options Find options the platform narrows its own read with, forwarded unchanged.
	 * @param saveOptions The platform's save options, forwarded unchanged.
	 * @returns The restored line.
	 * @throws NotFoundException when the line is not the caller's.
	 * @throws BadRequestException when its return would then ask back more than was fulfilled.
	 */
	public async softRecover(
		id: ID,
		options?: LegacyFindOneOptions<OrderReturnLine>,
		saveOptions?: SaveOptions
	): Promise<OrderReturnLine> {
		const line = await this.findLine(id, true);

		if (!line) {
			throw new NotFoundException('The return line was not found.');
		}

		const orderReturn = line.deletedAt && line.returnId ? await this.findReturn(line.returnId) : null;

		if (!orderReturn || !LIVE_RETURN_STATUSES.includes(orderReturn.status)) {
			return await super.softRecover(id, options, saveOptions);
		}

		await this.assertReturnable(
			orderReturn.orderId,
			[...(await this.findForReturn(orderReturn.id)), line].map((each) => ({
				orderLineId: each.orderLineId as ID,
				quantity: each.quantity
			})),
			orderReturn.id
		);

		return await this.whileMoved(orderReturn.orderId, outstandingMoves([line], 1n), () =>
			super.softRecover(id, options, saveOptions)
		);
	}

	/**
	 * Reads a line and the return it belongs to, when that return still counts against the order.
	 *
	 * @param id The line.
	 * @param withDeleted Whether a retired line is read too.
	 * @returns The line, and its return when the return is live; no return when it is withdrawn or retired.
	 * @throws NotFoundException when the line is not the caller's — which is also what a line of another
	 * organization of the tenant is, although the platform's own read would have found it.
	 */
	private async readLive(
		id: ID,
		withDeleted = false
	): Promise<{ line: OrderReturnLine; orderReturn: OrderReturn | null }> {
		const line = await this.findLine(id, withDeleted);

		if (!line) {
			throw new NotFoundException('The return line was not found.');
		}

		const orderReturn = line.returnId ? await this.findReturn(line.returnId) : null;

		return {
			line,
			orderReturn: orderReturn && LIVE_RETURN_STATUSES.includes(orderReturn.status) ? orderReturn : null
		};
	}

	/**
	 * Runs a write with the order's requested counter moved first, and moves it back when the write fails.
	 *
	 * The counter moves first for the reason a withdrawal moves it first: a move the order refuses — a
	 * counter the request was never added to would go below zero — refuses the write while the line is still
	 * exactly as it was. A write that did not land moves it back by exactly the moves that landed.
	 *
	 * @param orderId The order whose line counters move.
	 * @param moves The moves; an empty list moves nothing.
	 * @param write The write the moves belong to.
	 * @param landed Whether the write's answer says it changed something; by default every answer does.
	 * @returns What the write answered.
	 */
	private async whileMoved<R>(
		orderId: ID,
		moves: IOrderLineReturnRequestMove[],
		write: () => Promise<R>,
		landed: (result: R) => boolean = () => true
	): Promise<R> {
		const applied = await this.moveOrderLineRequest(orderId, moves);
		let result: R;

		try {
			result = await write();
		} catch (error) {
			await this.moveBack(orderId, applied);

			throw error;
		}

		if (!landed(result)) {
			await this.moveBack(orderId, applied);
		}

		return result;
	}

	/**
	 * Moves the order's requested counter back after a write it was moved for did not land.
	 *
	 * @param orderId The order.
	 * @param applied The moves that landed.
	 */
	private async moveBack(orderId: ID, applied: readonly IOrderLineReturnRequestMove[]): Promise<void> {
		try {
			await this.restoreOrderLineRequest(orderId, applied);
		} catch (compensationError) {
			this.logger.error(
				`A return line write of order ${orderId} did not land and the order's requested counter could not ` +
					`be moved back: ${describe(compensationError)}`
			);
		}
	}

	/**
	 * Moves the order's requested-return counter.
	 *
	 * @param orderId The order whose line counters move.
	 * @param moves The moves, never zeros.
	 * @returns The moves, once the order accepted them all; the port is all or nothing.
	 */
	private async moveOrderLineRequest(
		orderId: ID,
		moves: IOrderLineReturnRequestMove[]
	): Promise<IOrderLineReturnRequestMove[]> {
		if (moves.length === 0) {
			return [];
		}

		await this.requireFulfillment('what the return asks back cannot be recorded against the order').recordReturnRequest(
			orderId,
			moves
		);

		return moves;
	}

	/**
	 * @param consequence What cannot happen without the order capability, named in the refusal.
	 * @returns The order capability.
	 * @throws BadRequestException when it is not registered.
	 */
	private requireFulfillment(consequence: string): IOrderFulfillmentPort {
		if (!this.fulfillment) {
			throw new BadRequestException(
				`RETURN_FULFILLMENT_UNAVAILABLE: the order capability is not registered, so ${consequence}.`
			);
		}

		return this.fulfillment;
	}

	/**
	 * Records what physically arrived against a return's lines.
	 *
	 * @param returnId The return being received.
	 * @param inputs The quantities that arrived, per line.
	 * @returns The updated lines.
	 * @throws NotFoundException when a line does not belong to the return.
	 * @throws BadRequestException when a line's quantities are outside the requested quantity.
	 */
	public async recordReceipt(returnId: ID, inputs: IOrderReturnReceiptInput[]): Promise<OrderReturnLine[]> {
		return await this.applyReceipt(await this.planReceipt(returnId, inputs));
	}

	/**
	 * Writes one side of a receipt plan onto the lines it names.
	 *
	 * @param plan The validated receipt.
	 * @param side Which of the two states to write.
	 * @returns The written lines.
	 */
	private async writeReceipt(
		plan: IOrderReturnReceiptPlan[],
		side: 'receipt' | 'previous'
	): Promise<OrderReturnLine[]> {
		const touched: OrderReturnLine[] = [];

		for (const entry of plan) {
			entry.line.receivedQuantity = entry[side].receivedQuantity;
			entry.line.damagedQuantity = entry[side].damagedQuantity;
			entry.line.restock = entry[side].restock;
			touched.push(entry.line);
		}

		return await this.typeOrmOrderReturnLineRepository.save(touched);
	}

	/**
	 * Reads the return a line set belongs to, scoped to the caller's tenant and organization.
	 *
	 * @param returnId The return to read.
	 * @returns The return.
	 * @throws NotFoundException when it does not exist in this tenant and organization.
	 */
	private async readReturn(returnId: ID): Promise<OrderReturn> {
		const orderReturn = await this.findReturn(returnId);

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		return orderReturn;
	}

	/**
	 * Reads a return that has not been retired, scoped to the caller's tenant and organization, through the
	 * configured ORM.
	 *
	 * This service owns no repository of the return under MikroORM, so on that ORM the return is read through
	 * the entity manager its own repository is bound to — the persistence context of the request — which
	 * applies the soft-delete filter as any read of the ORM does.
	 *
	 * @param returnId The return to read.
	 * @returns The return, or null when it is not the caller's or it was retired.
	 */
	private async findReturn(returnId: ID): Promise<OrderReturn | null> {
		const where = {
			id: returnId,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};

		if (this.usesMikroOrm) {
			return await this.mikroOrmOrderReturnLineRepository.getEntityManager().findOne(OrderReturn, where as never);
		}

		return await this.typeOrmOrderReturnRepository.findOne({ where });
	}

	/**
	 * Reads one line, scoped to the caller's tenant and organization, through the configured ORM.
	 *
	 * @param id The line to read.
	 * @param withDeleted Whether a line that was retired is read too, which is what a restoration reads.
	 * @returns The line, or null when it is not the caller's.
	 */
	private async findLine(id: ID, withDeleted = false): Promise<OrderReturnLine | null> {
		const scope = {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};

		if (this.usesMikroOrm) {
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

		return await this.typeOrmOrderReturnLineRepository.findOne({
			where: { id, ...scope },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * @returns Whether MikroORM is the configured ORM, which decides the repository a read goes through.
	 */
	private get usesMikroOrm(): boolean {
		return this.ormType === MultiORMEnum.MikroORM;
	}

	/**
	 * Reads the orders that have a live return, which is what a "returns in progress" listing shows.
	 *
	 * @param orderIds The orders to test.
	 * @returns The subset that has at least one live return.
	 */
	public async findOrderIdsWithLiveReturns(orderIds: ID[]): Promise<ID[]> {
		if (!orderIds.length) {
			return [];
		}

		const rows = await this.typeOrmOrderReturnRepository.find({
			where: {
				orderId: In(orderIds),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				status: In(LIVE_RETURN_STATUSES)
			},
			select: { orderId: true }
		});

		return Array.from(new Set(rows.map((row) => row.orderId).filter((id) => !!id)));
	}

	/**
	 * Reads the returns of an order that no longer count against its fulfilled quantity.
	 *
	 * @param orderId The order to read.
	 * @returns The rejected and cancelled returns of the order.
	 */
	public async findReversedReturns(orderId: ID): Promise<OrderReturn[]> {
		return await this.typeOrmOrderReturnRepository.find({
			where: {
				orderId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				status: Not(In(LIVE_RETURN_STATUSES))
			}
		});
	}
}

/**
 * What a set of return lines still asks back, as moves of the order's requested-return counter.
 *
 * Each line's outstanding units are what it was requested for, less what already arrived sound or damaged:
 * a unit that arrived stays asked for, because it is on the received counter and I-12 bounds that counter by
 * this one. Lines of one order line are summed into one move, and a line with nothing outstanding moves
 * nothing.
 *
 * @param lines The lines.
 * @param sign `-1n` to give the units back to the order, `1n` to ask for them again.
 * @returns One move per order line that still has units outstanding, never a zero.
 * @throws BadRequestException when a line with units outstanding names no order line, so the order cannot
 * be told about them.
 */
function outstandingMoves(lines: readonly OrderReturnLine[], sign: bigint): IOrderLineReturnRequestMove[] {
	const units = new Map<ID, bigint>();

	for (const line of lines) {
		const outstanding =
			toQuantityUnits(line.quantity) -
			toQuantityUnits(line.receivedQuantity) -
			toQuantityUnits(line.damagedQuantity);

		if (outstanding <= 0n) {
			continue;
		}

		if (!line.orderLineId) {
			throw new BadRequestException(
				`RETURN_ORDER_LINE_UNLINKED: return line ${line.id} still asks for ${fromQuantityUnits(outstanding)} ` +
					`unit(s) and names no order line, so the request cannot be ${
						sign < 0n ? 'taken back from' : 'put back on'
					} the order.`
			);
		}

		units.set(line.orderLineId, (units.get(line.orderLineId) ?? 0n) + sign * outstanding);
	}

	return Array.from(units).map(([orderLineId, delta]) => ({ orderLineId, quantityDelta: fromQuantityUnits(delta) }));
}

/**
 * The same moves, the other way.
 *
 * The order line's counters are moved by a signed delta, and undoing a move is moving it back — so a
 * compensation sends the deltas it sent before, with the sign flipped, rather than a second quantity
 * the two could disagree about. A zero never reaches here: a delta of nothing is left out of the
 * moves, which is why the result is never `-0`.
 *
 * @param moves The moves that landed.
 * @returns The moves that undo them.
 */
function negateMoves<T extends { orderLineId: ID; quantityDelta: DecimalString }>(moves: readonly T[]): T[] {
	return moves.map((move) => ({
		...move,
		quantityDelta: move.quantityDelta.startsWith('-') ? move.quantityDelta.slice(1) : `-${move.quantityDelta}`
	}));
}

/**
 * @param error The failure.
 * @returns The failure as one line, so a log entry stays an entry.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
