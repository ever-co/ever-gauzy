import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	IOrderExchangeLineInput,
	IOrderFulfillmentPort,
	IOrderLineFulfillment,
	OrderExchangeStatus,
	RETURNS_ORDER_FULFILLMENT
} from '../returns.types';
import { normalizeQuantity, toQuantityUnits } from '../returns.quantity';
import { OrderExchange } from '../order-exchange/order-exchange.entity';
import { TypeOrmOrderExchangeRepository } from '../order-exchange/repository/type-orm-order-exchange.repository';
import { OrderExchangeLine } from './order-exchange-line.entity';
import { MikroOrmOrderExchangeLineRepository } from './repository/mikro-orm-order-exchange-line.repository';
import { TypeOrmOrderExchangeLineRepository } from './repository/type-orm-order-exchange-line.repository';

/** The exchange statuses in which its outbound line set may still be written. */
const EDITABLE_STATUSES: OrderExchangeStatus[] = [OrderExchangeStatus.OPEN, OrderExchangeStatus.REQUESTED];

/**
 * The outbound half of an exchange, and the prices the difference is computed from.
 *
 * A replacement is priced once, when the line is written, and the price is kept: `differenceDue` is
 * `outbound − inbound` and the customer is charged or credited exactly that, so re-resolving the
 * price later would rewrite what somebody already paid. When the replacement variant was on the
 * order, the order's own unit price is used — that is the price the customer already agreed to. When
 * it was not, the caller has to state one, and the service refuses the line rather than inventing a
 * price from nothing.
 *
 * Writing the lines moves no stock. The reservation happens when the exchange is approved.
 */
@Injectable()
export class OrderExchangeLineService extends TenantAwareCrudService<OrderExchangeLine> {
	constructor(
		readonly typeOrmOrderExchangeLineRepository: TypeOrmOrderExchangeLineRepository,
		readonly mikroOrmOrderExchangeLineRepository: MikroOrmOrderExchangeLineRepository,
		readonly typeOrmOrderExchangeRepository: TypeOrmOrderExchangeRepository,
		@Optional()
		@Inject(RETURNS_ORDER_FULFILLMENT)
		private readonly fulfillment?: IOrderFulfillmentPort
	) {
		super(typeOrmOrderExchangeLineRepository, mikroOrmOrderExchangeLineRepository);
	}

	/**
	 * Reads the outbound lines of an exchange, scoped to the caller's tenant and organization.
	 *
	 * @param exchangeId The exchange to read.
	 * @param withDeleted Whether lines retired by a later replacement write are included. Stated through
	 * the find options rather than as a filter on the returned rows, because the store is what knows a
	 * row was retired.
	 * @returns The lines, in the order they were written.
	 */
	public async findForExchange(exchangeId: ID, withDeleted?: boolean): Promise<OrderExchangeLine[]> {
		return await this.typeOrmOrderExchangeLineRepository.find({
			where: {
				exchangeId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * Replaces the outbound line set of an exchange that has not been resolved yet.
	 *
	 * @param exchangeId The exchange to write the lines of.
	 * @param inputs The replacement lines.
	 * @returns The written lines.
	 * @throws BadRequestException when the exchange is not editable, or when a replacement price
	 * cannot be resolved.
	 */
	public async replaceLines(exchangeId: ID, inputs: IOrderExchangeLineInput[]): Promise<OrderExchangeLine[]> {
		const exchange = await this.readExchange(exchangeId);

		if (!EDITABLE_STATUSES.includes(exchange.status)) {
			throw new BadRequestException(
				`The lines of an exchange in status "${exchange.status}" cannot be changed; only an open or requested exchange can be edited.`
			);
		}

		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('An exchange needs at least one outbound line.');
		}

		const fulfilled = await this.readFulfilledLines(exchange.orderId);
		const priced = inputs.map((input) => this.price(input, fulfilled, exchange.currency));

		await this.typeOrmOrderExchangeLineRepository.softDelete({ exchangeId });

		const lines: OrderExchangeLine[] = [];

		for (const line of priced) {
			lines.push(
				await super.create({
					exchangeId,
					orderLineId: line.orderLineId,
					variantId: line.variantId,
					quantity: normalizeQuantity(line.quantity),
					unitPrice: line.unitPrice,
					note: line.note
				} as any)
			);
		}

		return lines;
	}

	/**
	 * Prices one replacement line.
	 *
	 * @param input The requested line.
	 * @param fulfilled The order's fulfilled lines.
	 * @param currency The exchange's currency.
	 * @returns The line with a resolved, exact unit price.
	 * @throws BadRequestException when the quantity is not positive, the variant is missing, or no
	 * price could be resolved.
	 */
	private price(
		input: IOrderExchangeLineInput,
		fulfilled: Map<ID, IOrderLineFulfillment>,
		currency: CurrencyCode
	): { orderLineId?: ID; variantId: ID; quantity: DecimalString; unitPrice: DecimalString; note?: string } {
		if (toQuantityUnits(normalizeQuantity(input.quantity)) <= 0n) {
			throw new BadRequestException('An exchange line must ship a positive quantity.');
		}

		if (!input.variantId) {
			throw new BadRequestException('An exchange line must name the replacement variant.');
		}

		const fromOrder = input.orderLineId ? fulfilled.get(input.orderLineId)?.unitPrice : undefined;
		const requested = input.unitPrice !== undefined && input.unitPrice !== null ? String(input.unitPrice) : undefined;
		const resolved = requested ?? fromOrder;

		if (resolved === undefined || resolved === '') {
			throw new BadRequestException(
				`EXCHANGE_PRICE_UNAVAILABLE: no unit price could be resolved for replacement variant ${input.variantId}; ` +
					'state one on the line or offer the variant on the order first.'
			);
		}

		return {
			orderLineId: input.orderLineId,
			variantId: input.variantId,
			quantity: normalizeQuantity(input.quantity),
			unitPrice: Money.of(resolved, currency).round().toStorageString(),
			note: input.note
		};
	}

	/**
	 * Values a set of outbound lines in a currency.
	 *
	 * @param lines The lines to value.
	 * @param currency The currency to value them in.
	 * @returns The exact value, as a decimal string.
	 */
	public valueOf(lines: OrderExchangeLine[], currency: CurrencyCode): DecimalString {
		const values = lines.map((line) => Money.of(line.unitPrice ?? '0', currency).multiply(line.quantity ?? '0'));

		return Money.sum(values, currency).round().toStorageString();
	}

	/**
	 * The fulfilled quantities of an order, as the order domain reports them.
	 *
	 * @param orderId The order to read.
	 * @returns The fulfilled lines, keyed by order line.
	 * @throws BadRequestException when no order capability is registered.
	 */
	private async readFulfilledLines(orderId: ID): Promise<Map<ID, IOrderLineFulfillment>> {
		if (!this.fulfillment) {
			throw new BadRequestException(
				'EXCHANGE_FULFILLMENT_UNAVAILABLE: the order capability is not registered, so replacement prices cannot be resolved from the order.'
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
	 * @param exchangeId The exchange to read.
	 * @returns The exchange.
	 * @throws NotFoundException when it does not exist in this tenant and organization.
	 */
	private async readExchange(exchangeId: ID): Promise<OrderExchange> {
		const exchange = await this.typeOrmOrderExchangeRepository.findOne({
			where: {
				id: exchangeId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!exchange) {
			throw new NotFoundException('The exchange was not found.');
		}

		return exchange;
	}
}
