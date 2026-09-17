import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import {
	IOrderReturnLineInput,
	IOrderReturnReceiptOutcome,
	IOrderReturnReceiptInput,
	IRefundGatewayPort,
	IRefundResult,
	IReturnShipmentPort,
	IReturnShipmentResult,
	IStockLedgerPort,
	OrderReturnStatus,
	RETURNS_REFUND_GATEWAY,
	RETURNS_SHIPMENT_GATEWAY,
	RETURNS_STOCK_LEDGER,
	StockMovementKind
} from '../returns.types';
import { fromQuantityUnits, subtractQuantities, sumQuantities, toQuantityUnits } from '../returns.quantity';
import { Money, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { OrderReturnLine } from '../order-return-line/order-return-line.entity';
import { IOrderReturnReceiptPlan, OrderReturnLineService } from '../order-return-line/order-return-line.service';
import { OrderReturn } from './order-return.entity';
import { MikroOrmOrderReturnRepository } from './repository/mikro-orm-order-return.repository';
import { TypeOrmOrderReturnRepository } from './repository/type-orm-order-return.repository';

/** The series key returns are numbered from. */
const RETURN_NUMBER_KEY = 'RETURN';

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
	/** Why the movement happened. */
	reason: string;
}

/** One movement the ledger accepted, kept so a receipt that cannot finish can be reversed. */
interface IPostedMovement extends IPlannedMovement {
	/** The ledger's own row, when it reported one. */
	movementId?: ID;
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
 */
@Injectable()
export class OrderReturnService extends TenantAwareCrudService<OrderReturn> {
	constructor(
		readonly typeOrmOrderReturnRepository: TypeOrmOrderReturnRepository,
		readonly mikroOrmOrderReturnRepository: MikroOrmOrderReturnRepository,
		private readonly lineService: OrderReturnLineService,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(RETURNS_STOCK_LEDGER)
		private readonly stockLedger?: IStockLedgerPort,
		@Optional()
		@Inject(RETURNS_REFUND_GATEWAY)
		private readonly refundGateway?: IRefundGatewayPort,
		@Optional()
		@Inject(RETURNS_SHIPMENT_GATEWAY)
		private readonly shipmentGateway?: IReturnShipmentPort
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
	 * @returns The approved return.
	 */
	public async approve(id: ID, note?: string): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, [OrderReturnStatus.OPEN, OrderReturnStatus.REQUESTED], 'approve');

		await super.update(id, {
			status: OrderReturnStatus.APPROVED,
			approvedAt: new Date(),
			note: note ?? orderReturn.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Rejects a return. Terminal: a rejected return no longer counts against the order's fulfilled
	 * quantity, which is what lets the customer ask again with a corrected request.
	 *
	 * @param id The return to reject.
	 * @param reason Why it was rejected.
	 * @returns The rejected return.
	 */
	public async reject(id: ID, reason?: string): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, DECIDABLE_STATUSES, 'reject');

		await super.update(id, {
			status: OrderReturnStatus.REJECTED,
			reason: reason ?? orderReturn.reason
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Cancels a return before its goods were received.
	 *
	 * @param id The return to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled return.
	 */
	public async cancel(id: ID, reason?: string): Promise<OrderReturn> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, DECIDABLE_STATUSES, 'cancel');

		await super.update(id, {
			status: OrderReturnStatus.CANCELED,
			canceledAt: new Date(),
			reason: reason ?? orderReturn.reason
		} as any);

		return await this.findOneScoped(id);
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
	 * @returns What the receipt did.
	 */
	public async receive(
		id: ID,
		lines: IOrderReturnReceiptInput[],
		options: { warehouseId?: ID; refund?: string | number; note?: string } = {}
	): Promise<IOrderReturnReceiptOutcome> {
		const orderReturn = await this.findOneScoped(id);

		this.assertStatus(orderReturn, RECEIVABLE_STATUSES, 'receive');

		const posted: IPostedMovement[] = [];
		let plan: IOrderReturnReceiptPlan[] = [];
		let settlement = { received: '0', outstanding: '0' };

		try {
			const fulfilled = await this.lineService.readFulfilledLines(orderReturn.orderId);
			plan = await this.lineService.planReceipt(id, lines);

			const movements = this.planMovements(orderReturn, plan, fulfilled, options.warehouseId);

			settlement = this.summarize(plan);

			const status =
				toQuantityUnits(settlement.outstanding) === 0n
					? OrderReturnStatus.RECEIVED
					: OrderReturnStatus.PARTIALLY_RECEIVED;

			await this.lineService.applyReceipt(plan);

			for (const movement of movements) {
				posted.push(await this.postMovement(orderReturn, movement));
			}

			// The status is written last, and the refund below reads it: the refund guard refuses a
			// return that has not received anything, which is the check that keeps money behind goods.
			await super.update(id, {
				status,
				receivedAt: new Date(),
				warehouseId: options.warehouseId ?? orderReturn.warehouseId,
				note: options.note ?? orderReturn.note
			} as any);
		} catch (error) {
			await this.compensateReceipt(orderReturn, plan, posted);

			throw error;
		}

		const updated = await this.findOneScoped(id);

		let refund: IRefundResult | undefined;

		if (options.refund !== undefined && options.refund !== null && String(options.refund) !== '') {
			refund = await this.refund(id, options.refund, undefined, options.note);
		}

		return {
			returnId: updated.id,
			status: updated.status,
			movementIds: posted
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
	 * @returns The refund that was written.
	 * @throws BadRequestException when the return has not received anything yet, or when no payment
	 * capability is registered.
	 */
	public async refund(id: ID, amount: string | number, reasonId?: ID, note?: string): Promise<IRefundResult> {
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

		await super.update(id, { refundAmount: runningTotal } as any);

		return result;
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
	 * A header that claims `RECEIVED` while one of its lines still owes units contradicts itself, and
	 * that is refused rather than closed short: `RECEIVED` is the claim that everything arrived, so a
	 * return may not close on a claim its own lines deny. The short close belongs to the state that
	 * admits the shortfall.
	 *
	 * @param id The return to close.
	 * @returns The closed return.
	 */
	public async close(id: ID): Promise<OrderReturn> {
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

		await super.update(id, {
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
		} as any);

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
	 * @returns What the shipping capability created.
	 */
	public async createShipment(
		id: ID,
		options: { shippingOptionId?: ID; warehouseId?: ID; trackingNumber?: string } = {}
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

		await super.update(id, {
			shippingOptionId: options.shippingOptionId ?? orderReturn.shippingOptionId
		} as any);

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
	 * happened to it: a restocked unit is a `RETURN`, a unit that came back unsellable is a
	 * `WRITE_OFF` (recorded without ever entering sellable stock), and a unit that arrived broken is a
	 * `DAMAGE`. What the line already held is subtracted first, because the ledger holds every arrival
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
		const pending: Array<{ line: OrderReturnLine; quantity: string; kind: StockMovementKind; reason: string }> = [];

		for (const entry of plan) {
			const received = subtractQuantities(entry.receipt.receivedQuantity, entry.previous.receivedQuantity);
			const damaged = subtractQuantities(entry.receipt.damagedQuantity, entry.previous.damagedQuantity);
			const restock = entry.receipt.restock;

			if (toQuantityUnits(received) > 0n) {
				pending.push({
					line: entry.line,
					quantity: received,
					kind: restock ? StockMovementKind.RETURN : StockMovementKind.WRITE_OFF,
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
	 * 3. the header is stated in the state it was read in, so a reader finds the return it had.
	 *
	 * This is a compensating action rather than a rollback: the rows live in two places — this plugin's
	 * tables and the ledger — and no transaction spans them, so the receipt is undone in the reverse of
	 * the order it was done in.
	 *
	 * @param orderReturn The return as it was read, which is the state the receipt is undone to.
	 * @param plan The receipt that was being written.
	 * @param posted The movements the ledger accepted before the failure.
	 */
	private async compensateReceipt(
		orderReturn: OrderReturn,
		plan: IOrderReturnReceiptPlan[],
		posted: IPostedMovement[]
	): Promise<void> {
		await this.reverseMovements(orderReturn, posted);
		await this.lineService.restoreReceipt(plan);

		await super.update(orderReturn.id, {
			status: orderReturn.status,
			receivedAt: orderReturn.receivedAt,
			warehouseId: orderReturn.warehouseId,
			note: orderReturn.note
		} as any);
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
		const orderReturn = await this.typeOrmOrderReturnRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!orderReturn) {
			throw new NotFoundException('The return was not found.');
		}

		return orderReturn;
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
