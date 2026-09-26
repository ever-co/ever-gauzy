import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import {
	IOrderExchangeLineInput,
	IOrderFulfillmentPort,
	OrderExchangeStatus,
	RETURNS_ORDER_FULFILLMENT
} from '../returns.types';
import { OrderExchangeLineService } from '../order-exchange-line/order-exchange-line.service';
import { OrderExchangeLine } from '../order-exchange-line/order-exchange-line.entity';
import { OrderReturnLineService } from '../order-return-line/order-return-line.service';
import { OrderExchange } from './order-exchange.entity';
import { MikroOrmOrderExchangeRepository } from './repository/mikro-orm-order-exchange.repository';
import { TypeOrmOrderExchangeRepository } from './repository/type-orm-order-exchange.repository';

/** The series key exchanges are numbered from. */
const EXCHANGE_NUMBER_KEY = 'EXCHANGE';

/** Statuses an exchange may still be decided from. */
const DECIDABLE_STATUSES: OrderExchangeStatus[] = [OrderExchangeStatus.OPEN, OrderExchangeStatus.REQUESTED];

/**
 * A return that immediately becomes a new shipment.
 *
 * The domain exists for one number. `differenceDue` is the outbound replacement value minus the
 * inbound returned value, and it is what the customer is charged or credited once the exchange is
 * approved; computing it after the fact from live prices would mean the customer pays a number nobody
 * quoted them. So both halves are snapshotted — the replacement unit prices on the outbound lines,
 * and the returned quantities at the order's own unit prices on the inbound side — and the difference
 * is computed through the platform money layer, exactly, in the exchange's currency.
 *
 * An exchange needs both halves: outbound lines to ship and a return to receive. Approving one
 * without the other is refused, because a one-sided exchange is either a sale or a return.
 *
 * **ADR-26 names an exchange among the moves that must recompute the order's derived columns, and this
 * service is the one writer of the five that does not call for one.** The reason is stated on `approve`
 * beside the resolution it is about, and it is this: nothing this class writes is an input to any of the
 * three derivations — it has no refund gateway, no stock ledger and no reservation port, and every
 * method writes the exchange's own row and its own lines. The recompute is wired where the ledger
 * actually moves, in `OrderReturnService` and `OrderClaimService`, and an exchange's money reaches the
 * ledger through its inbound return, which is that first service's flow.
 */
@Injectable()
export class OrderExchangeService extends TenantAwareCrudService<OrderExchange> {
	constructor(
		readonly typeOrmOrderExchangeRepository: TypeOrmOrderExchangeRepository,
		readonly mikroOrmOrderExchangeRepository: MikroOrmOrderExchangeRepository,
		private readonly lineService: OrderExchangeLineService,
		private readonly returnLineService: OrderReturnLineService,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(RETURNS_ORDER_FULFILLMENT)
		private readonly fulfillment?: IOrderFulfillmentPort
	) {
		super(typeOrmOrderExchangeRepository, mikroOrmOrderExchangeRepository);
	}

	/**
	 * Requests an exchange against an order.
	 *
	 * @param entity The exchange to create, with its outbound lines.
	 * @returns The created exchange, with its lines.
	 */
	public async create(
		entity: Partial<OrderExchange> & { lines?: IOrderExchangeLineInput[] }
	): Promise<OrderExchange> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { lines = [], ...header } = entity;

		if (!header.orderId) {
			throw new BadRequestException('An exchange must name the order it is against.');
		}

		if (!header.currency) {
			throw new BadRequestException('An exchange must state the currency its amounts are in.');
		}

		if (!lines.length) {
			throw new BadRequestException('An exchange needs at least one outbound line.');
		}

		const number = await this.allocateNumber();

		const exchange = await super.create({
			...header,
			number,
			status: OrderExchangeStatus.OPEN,
			allowBackorder: header.allowBackorder ?? false,
			tenantId,
			organizationId
		} as any);

		exchange.lines = await this.lineService.replaceLines(exchange.id, lines);

		if (exchange.returnId) {
			exchange.differenceDue = await this.computeDifference(exchange);
			await super.update(exchange.id, { differenceDue: exchange.differenceDue } as any);
		}

		return exchange;
	}

	/**
	 * Replaces the outbound line set of an exchange that has not been resolved yet.
	 *
	 * The lines are owned by `OrderExchangeLineService`, which is the only place a replacement is
	 * priced; this method exists so a caller holding the exchange can edit it without reaching for
	 * another service.
	 *
	 * @param id The exchange to write the lines of.
	 * @param lines The replacement lines.
	 * @returns The written lines.
	 */
	public async replaceLines(id: ID, lines: IOrderExchangeLineInput[]): Promise<OrderExchangeLine[]> {
		return await this.lineService.replaceLines(id, lines);
	}

	/**
	 * Approves an exchange: prices the difference and hands both halves over to be executed.
	 *
	 * The approval is where the two halves are required to exist together, and where the difference is
	 * frozen. Re-reserving the replacement and adjusting the payment collection are the durable
	 * operation's work, which is why `settleDifference` is recorded on the exchange rather than
	 * recomputed: the exchange is the record of what was quoted.
	 *
	 * **This is the exchange's resolution, so it is where a reader asks why no order recompute is owed
	 * here — and the answer is that nothing this service can write moves one.** `OrderTotalsService`
	 * derives three things: `computeTotals` from the order's lines, its shipping methods, its credit
	 * lines, its adjustments, its tax lines and its `order_transaction` ledger; `derivePaymentStatus`
	 * from the order's status, that snapshot and the same ledger; and `deriveFulfillmentStatus` from the
	 * order's status and five sums over its lines. Every method below writes the exchange's **own** row
	 * and its own lines, and nothing else — this service injects no refund gateway, no stock ledger and
	 * no reservation port, so it has no way to append a ledger row even by accident, and
	 * `order_exchange.returnId` is a link rather than a counter. Doc 10 §12.5's `settle-difference` step
	 * — adjust the collection, authorise the delta, refund `abs(differenceDue)` when the customer is owed
	 * — is not implemented in this package; the difference is priced onto the row and left there. **When
	 * that step is implemented, it belongs here and it owes a recompute**, because it would be the
	 * exchange's first write to a ledger the derivation reads.
	 *
	 * The money that *can* move for an exchange today moves through its inbound half: the linked return's
	 * receipt and refund run on `OrderReturnService`, which is where the recompute is wired. So an
	 * exchange's ledger is covered by the return's writer rather than by a second call site here — one
	 * refund, one recompute, whichever of the two flows raised it.
	 *
	 * @param id The exchange to approve.
	 * @param note An operator note.
	 * @returns The approved exchange.
	 */
	public async approve(id: ID, note?: string): Promise<OrderExchange> {
		const exchange = await this.findOneScoped(id);

		this.assertStatus(exchange, DECIDABLE_STATUSES, 'approve');

		const lines = await this.lineService.findForExchange(id);

		if (!lines.length) {
			throw new BadRequestException('An exchange must have at least one outbound line before it can be approved.');
		}

		if (!exchange.returnId) {
			throw new BadRequestException(
				'An exchange must have an inbound return before it can be approved, otherwise there is nothing coming back.'
			);
		}

		const inbound = await this.returnLineService.findForReturn(exchange.returnId);

		if (!inbound.length) {
			throw new BadRequestException('The inbound return of this exchange has no lines, so the difference cannot be priced.');
		}

		const differenceDue = await this.computeDifference(exchange);

		await super.update(id, {
			status: OrderExchangeStatus.APPROVED,
			differenceDue,
			note: note ?? exchange.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Rejects an exchange. Terminal.
	 *
	 * @param id The exchange to reject.
	 * @param reason Why it was rejected.
	 * @returns The rejected exchange.
	 */
	public async reject(id: ID, reason?: string): Promise<OrderExchange> {
		const exchange = await this.findOneScoped(id);

		this.assertStatus(exchange, [...DECIDABLE_STATUSES, OrderExchangeStatus.APPROVED], 'reject');

		await super.update(id, {
			status: OrderExchangeStatus.REJECTED,
			note: reason ?? exchange.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Cancels an exchange.
	 *
	 * @param id The exchange to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled exchange.
	 */
	public async cancel(id: ID, reason?: string): Promise<OrderExchange> {
		const exchange = await this.findOneScoped(id);

		this.assertStatus(exchange, [...DECIDABLE_STATUSES, OrderExchangeStatus.APPROVED], 'cancel');

		await super.update(id, {
			status: OrderExchangeStatus.CANCELED,
			canceledAt: new Date(),
			note: reason ?? exchange.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Closes an exchange whose two halves have both settled.
	 *
	 * @param id The exchange to close.
	 * @param note An operator note.
	 * @returns The closed exchange.
	 */
	public async close(id: ID, note?: string): Promise<OrderExchange> {
		const exchange = await this.findOneScoped(id);

		if (exchange.status === OrderExchangeStatus.CLOSED) {
			return exchange;
		}

		this.assertStatus(exchange, [OrderExchangeStatus.APPROVED], 'close');

		await super.update(id, {
			status: OrderExchangeStatus.CLOSED,
			note: note ?? exchange.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Links the inbound return, which is what makes the exchange priceable and approvable.
	 *
	 * @param id The exchange.
	 * @param returnId The return that brings the original goods back.
	 * @returns The updated exchange.
	 */
	public async linkReturn(id: ID, returnId: ID): Promise<OrderExchange> {
		await this.findOneScoped(id);

		await super.update(id, { returnId } as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads an exchange with everything a detail view shows.
	 *
	 * @param id The exchange to read.
	 * @returns The exchange, its outbound lines and its inbound return.
	 */
	public async findOneDetailed(id: ID): Promise<OrderExchange> {
		const exchange = await this.typeOrmOrderExchangeRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true, return: { lines: true } }
		});

		if (!exchange) {
			throw new NotFoundException('The exchange was not found.');
		}

		return exchange;
	}

	/**
	 * Prices an exchange: outbound value minus inbound value, in the exchange's currency.
	 *
	 * Both sides are computed through the platform money layer, so the difference is exact at the
	 * currency's scale and a customer is never charged a rounding artefact. The outbound side uses the
	 * snapshotted unit prices; the inbound side uses the order's own unit prices for the returned
	 * quantities, which is what the customer originally paid for them.
	 *
	 * @param exchange The exchange to price.
	 * @returns The difference, as an exact decimal string. Positive when the customer owes money.
	 * @throws BadRequestException when the inbound side cannot be priced from the order.
	 */
	public async computeDifference(exchange: OrderExchange): Promise<DecimalString> {
		if (!exchange.returnId) {
			throw new BadRequestException('An exchange has no difference until its inbound return exists.');
		}

		const outbound = await this.lineService.findForExchange(exchange.id);
		const inbound = await this.returnLineService.findForReturn(exchange.returnId);

		if (!this.fulfillment) {
			throw new BadRequestException(
				'EXCHANGE_FULFILLMENT_UNAVAILABLE: the order capability is not registered, so the inbound value of the exchange cannot be priced.'
			);
		}

		const fulfilled = await this.fulfillment.getFulfilledLines(exchange.orderId);
		const unitPrices = new Map<ID, DecimalString>();

		for (const line of fulfilled ?? []) {
			if (line?.orderLineId && line.unitPrice !== undefined && line.unitPrice !== null) {
				unitPrices.set(line.orderLineId, line.unitPrice);
			}
		}

		const inboundValues = inbound.map((line) => {
			const unitPrice = line.orderLineId ? unitPrices.get(line.orderLineId) : undefined;

			if (unitPrice === undefined) {
				throw new BadRequestException(
					`EXCHANGE_PRICE_UNAVAILABLE: the unit price of order line ${line.orderLineId} could not be read, so the inbound value of the exchange cannot be priced.`
				);
			}

			return Money.of(unitPrice, exchange.currency).multiply(line.quantity ?? '0');
		});

		const outboundValue = Money.of(this.lineService.valueOf(outbound, exchange.currency), exchange.currency);
		const inboundValue = Money.sum(inboundValues, exchange.currency);

		return outboundValue.subtract(inboundValue).round().toStorageString();
	}

	/**
	 * Reads the outbound lines of an exchange as a caller would see them.
	 *
	 * @param id The exchange to read.
	 * @returns The lines.
	 */
	public async findLines(id: ID): Promise<OrderExchangeLine[]> {
		return await this.lineService.findForExchange(id);
	}

	/**
	 * Allocates the next exchange number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(EXCHANGE_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for exchanges (key "${EXCHANGE_NUMBER_KEY}"), so an exchange number cannot be allocated.`
			);
		}
	}

	/**
	 * @param id The exchange to read.
	 * @returns The exchange, when it belongs to the caller's tenant and organization.
	 * @throws NotFoundException when it does not.
	 */
	private async findOneScoped(id: ID): Promise<OrderExchange> {
		const exchange = await this.typeOrmOrderExchangeRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!exchange) {
			throw new NotFoundException('The exchange was not found.');
		}

		return exchange;
	}

	/**
	 * @param exchange The exchange the transition is attempted on.
	 * @param allowed The statuses it may be attempted from.
	 * @param action The action being attempted, named in the error.
	 * @throws BadRequestException when the exchange is not in one of the allowed statuses.
	 */
	private assertStatus(exchange: OrderExchange, allowed: OrderExchangeStatus[], action: string): void {
		if (!allowed.includes(exchange.status)) {
			throw new BadRequestException(
				`An exchange in status "${exchange.status}" cannot ${action}; expected ${allowed.join(' or ')}.`
			);
		}
	}
}
