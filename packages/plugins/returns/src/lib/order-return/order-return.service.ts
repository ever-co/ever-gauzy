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
import { subtractQuantities, sumQuantities, toQuantityUnits } from '../returns.quantity';
import { Money, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { OrderReturnLine } from '../order-return-line/order-return-line.entity';
import { OrderReturnLineService } from '../order-return-line/order-return-line.service';
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
	 * 1. the lines are re-validated and their received quantities recorded;
	 * 2. the return moves to `RECEIVED` or `PARTIALLY_RECEIVED`, so the refund that follows is issued
	 *    against a return that already says the goods are in;
	 * 3. a stock movement is written for every unit that arrived — a `RETURN` for the units going back
	 *    on the shelf, a `WRITE_OFF` for the units that came back unsellable, and a `DAMAGE` record
	 *    for the ones that arrived broken — through the ledger, never by writing a level here;
	 * 4. only then is the refund issued, so money never leaves for goods the ledger refused.
	 *
	 * A partial receipt leaves the return `PARTIALLY_RECEIVED` and keeps the remainder outstanding;
	 * the same lines can be received again. Closing is deliberately not automatic: a fully received
	 * return that is still being inspected must stay open, and `close` is what ends it.
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

		const fulfilled = await this.lineService.readFulfilledLines(orderReturn.orderId);
		const recorded = await this.lineService.recordReceipt(id, lines);
		const settlement = this.summarize(recorded);

		const status =
			toQuantityUnits(settlement.outstanding) === 0n
				? OrderReturnStatus.RECEIVED
				: OrderReturnStatus.PARTIALLY_RECEIVED;

		// The status is written first: the refund below reads the return and refuses to refund one
		// that has not received anything, which is the check that keeps money behind goods.
		await super.update(id, {
			status,
			receivedAt: new Date(),
			warehouseId: options.warehouseId ?? orderReturn.warehouseId,
			note: options.note ?? orderReturn.note
		} as any);

		const movementIds = await this.writeStockMovements(orderReturn, recorded, fulfilled, options.warehouseId);

		let refund: IRefundResult | undefined;

		if (options.refund !== undefined && options.refund !== null && String(options.refund) !== '') {
			refund = await this.refund(id, options.refund, undefined, options.note);
		}

		const updated = await this.findOneScoped(id);

		return {
			returnId: updated.id,
			status: updated.status,
			movementIds,
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
	 * Closes a return whose goods are all in and whose refund is settled.
	 *
	 * Closing is deliberate rather than automatic: a fully received return that is still being
	 * inspected or haggled over must stay open, and `CLOSED` is the state that says nothing further
	 * can happen to it.
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

		if (lines.some((line) => toQuantityUnits(line.quantity) > toQuantityUnits(sumQuantities([line.receivedQuantity, line.damagedQuantity])))) {
			throw new BadRequestException(
				'This return still has lines that were not fully received; receive them or cancel the return before closing it.'
			);
		}

		await super.update(id, { status: OrderReturnStatus.CLOSED, closedAt: new Date() } as any);

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
	 * Writes the stock movements a receipt produced.
	 *
	 * Every unit that arrived produces exactly one movement, and which one depends on what happened to
	 * it: a restocked unit is a `RETURN`, a unit that came back unsellable is a `WRITE_OFF` (recorded
	 * without ever entering sellable stock), and a unit that arrived broken is a `DAMAGE`. The ledger
	 * owns the level; this method only states what happened.
	 *
	 * @param orderReturn The return being received.
	 * @param lines The lines as they were recorded.
	 * @param fulfilled The order's fulfilled lines, which name the variant each line is for.
	 * @param warehouseId The receiving location, when it was given on the request.
	 * @returns The movement ids the ledger wrote.
	 * @throws BadRequestException when there is something to move and no ledger is registered, or
	 * when the variant or the location of a movement is unknown.
	 */
	private async writeStockMovements(
		orderReturn: OrderReturn,
		lines: OrderReturnLine[],
		fulfilled: Map<ID, { variantId?: ID }>,
		warehouseId?: ID
	): Promise<ID[]> {
		const pending: Array<{ line: OrderReturnLine; quantity: string; kind: StockMovementKind; reason: string }> = [];

		for (const line of lines) {
			const received = line.receivedQuantity ?? '0';
			const damaged = line.damagedQuantity ?? '0';
			const restock = line.restock !== false;

			if (toQuantityUnits(received) > 0n) {
				pending.push({
					line,
					quantity: received,
					kind: restock ? StockMovementKind.RETURN : StockMovementKind.WRITE_OFF,
					reason: restock
						? 'Returned goods went back into sellable stock.'
						: 'Returned goods were not restocked.'
				});
			}

			if (toQuantityUnits(damaged) > 0n) {
				pending.push({
					line,
					quantity: damaged,
					kind: StockMovementKind.DAMAGE,
					reason: 'Returned goods arrived damaged.'
				});
			}
		}

		if (!pending.length) {
			return [];
		}

		if (!this.stockLedger) {
			throw new BadRequestException(
				'RETURN_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so returned goods cannot be written back to stock.'
			);
		}

		const movementIds: ID[] = [];

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

			const result = await this.stockLedger.recordMovement({
				warehouseId: warehouse,
				variantId,
				quantity: movement.quantity,
				kind: movement.kind,
				referenceType: 'ORDER_RETURN',
				referenceId: orderReturn.id,
				reason: movement.reason
			});

			if (result?.movementId) {
				movementIds.push(result.movementId);
			}
		}

		return movementIds;
	}

	/**
	 * @param lines The lines as they were recorded.
	 * @returns The received and outstanding quantities of the whole return, as exact decimals.
	 */
	private summarize(lines: OrderReturnLine[]): { received: string; outstanding: string } {
		let received = '0';
		let outstanding = '0';

		for (const line of lines) {
			const settled = sumQuantities([line.receivedQuantity, line.damagedQuantity]);

			received = sumQuantities([received, settled]);
			outstanding = sumQuantities([
				outstanding,
				toQuantityUnits(settled) > toQuantityUnits(line.quantity)
					? '0'
					: subtractQuantities(line.quantity, settled)
			]);
		}

		return { received, outstanding };
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
