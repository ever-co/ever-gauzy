import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	Money,
	RequestContext,
	TenantAwareCrudService,
	addDecimalStrings,
	compareDecimalStrings
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderLine } from './order-line.entity';
import { TypeOrmOrderLineRepository } from './repository/type-orm-order-line.repository';
import { MikroOrmOrderLineRepository } from './repository/mikro-orm-order-line.repository';

/** One refund as the payment side records it against a line. */
export interface IRecordLineRefundInput {
	/** The order line the money was paid back on. */
	orderLineId: ID;
	/** The quantity paid back. */
	quantity: number | string;
	/** The money paid back, in the order's currency, as a positive magnitude. */
	amount: number | string;
	/** The order's currency; checked against the order the line belongs to. */
	currency: string;
}

/**
 * the lines of an order: what was bought, at the price it was bought at.
 *
 * The quantity counters are caches of the fulfilment and return rows that cause them and are never
 * authored here. The two **refund** counters are written here, because they are the one register whose
 * evidence lives in another capability: the `refund_line` rows belong to the payment domain and this
 * package must not read them, so the payment side reports what it paid back and this service moves the
 * register in one guarded write — the same division the invoicing register uses, where the bridge
 * writes the link and the counter together.
 *
 * A refund is recorded in as many parts as it was paid in, which is what makes two partial refunds of
 * one line expressible: the register accumulates both, and the reconciliation re-derives it from the
 * totals the payment side reports.
 */
@Injectable()
export class OrderLineService extends TenantAwareCrudService<OrderLine> {
	constructor(
		readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository,
		readonly mikroOrmOrderLineRepository: MikroOrmOrderLineRepository,
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository
	) {
		super(typeOrmOrderLineRepository, mikroOrmOrderLineRepository);
	}

	/**
	 * Records one refund against a line, in as many parts as it was paid in.
	 *
	 * The line is read inside the transaction, the new counters are computed from what it holds plus
	 * this refund, and the write is conditional on the counters the transaction read — so two refunds
	 * written concurrently cannot both claim to be the second one. Both totals are exact decimals: a
	 * refunded amount that drifted by a rounding error would disagree with the ledger that caused it.
	 *
	 * @param input The refund to record.
	 * @returns The line, as it now stands.
	 * @throws BadRequestException when the quantity or the amount is not a positive decimal, when the
	 * line has not invoiced enough to refund that much, or when the line moved under this write.
	 * @throws NotFoundException when the line or its order does not exist in the caller's tenant.
	 */
	public async recordRefund(input: IRecordLineRefundInput): Promise<OrderLine> {
		const quantity = this.readPositive(input.quantity, 'quantity');
		const amount = this.readPositive(input.amount, 'amount');
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!input.orderLineId) {
			throw new BadRequestException('ORDER_LINE_REFUND_LINE_REQUIRED: a refund is recorded against one order line.');
		}

		return await this.typeOrmOrderLineRepository.manager.transaction(async (manager) => {
			const line = await manager.findOne(OrderLine, {
				where: { id: input.orderLineId, tenantId, organizationId }
			});

			if (!line) {
				throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${input.orderLineId}.`);
			}

			const order = await this.typeOrmOrderRepository.findOne({
				where: { id: line.orderId, tenantId, organizationId } as FindOptionsWhere<Order>
			});

			if (!order) {
				throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${line.orderId}.`);
			}

			if (String(order.currency).toUpperCase() !== String(input.currency ?? '').toUpperCase()) {
				throw new BadRequestException(
					`ORDER_LINE_REFUND_CURRENCY_MISMATCH: the order is in ${order.currency} and the refund states ${input.currency}, ` +
						'so the two cannot be summed into one total.'
				);
			}

			const refundedQuantity = addDecimalStrings(`${line.refundedQuantity ?? 0}`, quantity);
			const invoiced = `${line.invoicedQuantity ?? 0}`;

			if (compareDecimalStrings(refundedQuantity, invoiced) > 0) {
				throw new BadRequestException(
					`ORDER_LINE_REFUND_EXCEEDS_INVOICED: the line has billed ${invoiced} and ${refundedQuantity} would be refunded, ` +
						'which gives back more than was charged.'
				);
			}

			// Both the running total and this refund are money, so the sum goes through the platform money
			// helper: a refunded amount that drifted by a rounding error would disagree with the ledger that
			// caused it. The line carries no currency of its own — its order does.
			const refundedAmount = Money.of(`${line.refundedAmount ?? 0}`, order.currency)
				.add(Money.of(amount, order.currency))
				.toStorageString();

			const written = await manager.update(
				OrderLine,
				{
					id: line.id,
					refundedQuantity: (line.refundedQuantity ?? 0) as any,
					refundedAmount: (line.refundedAmount ?? 0) as any
				},
				{ refundedQuantity: Number(refundedQuantity), refundedAmount: Number(refundedAmount) } as any
			);

			if (!written.affected) {
				throw new BadRequestException(
					'ORDER_LINE_REFUND_CONFLICT: the line was refunded by another write between this one reading it and writing it, ' +
						'so the counters were not overwritten. Read the line and record the refund again.'
				);
			}

			return (await manager.findOne(OrderLine, { where: { id: line.id } })) as OrderLine;
		});
	}

	/**
	 * Re-derives a line's refund counters from the totals the payment side reports.
	 *
	 * The reconciliation half of the register: the payment domain owns the `refund_line` rows and this
	 * package owns the cache of them, so the truth is reported here rather than read across a package
	 * boundary. Running it twice produces the same numbers, which is what makes it safe to call from a
	 * nightly job.
	 *
	 * @param orderLineId The line to re-derive.
	 * @param totals What the succeeded refunds of the line add up to, as exact decimals.
	 * @returns The line, with its refund counters re-derived.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async recomputeRefundCounters(
		orderLineId: ID,
		totals: { refundedQuantity: number | string; refundedAmount: number | string }
	): Promise<OrderLine> {
		const line = await this.findOneByIdString(orderLineId);
		const quantity = this.readDecimal(totals?.refundedQuantity ?? 0, 'refundedQuantity');
		const amount = this.readDecimal(totals?.refundedAmount ?? 0, 'refundedAmount');

		await this.typeOrmOrderLineRepository.update(line.id, {
			refundedQuantity: Number(quantity),
			refundedAmount: Number(amount)
		} as DeepPartial<OrderLine> as any);

		return (await this.typeOrmOrderLineRepository.findOne({ where: { id: line.id } })) as OrderLine;
	}

	/**
	 * @param value A value from a caller.
	 * @param field The field name, used in the refusal.
	 * @returns The value as an exact decimal string.
	 * @throws BadRequestException when the value is not a positive decimal.
	 */
	private readPositive(value: number | string, field: string): string {
		const text = this.readDecimal(value, field);

		if (compareDecimalStrings(text, '0') <= 0) {
			throw new BadRequestException(
				`ORDER_LINE_REFUND_INVALID: a refund is recorded as a positive ${field}; the direction is the refund itself.`
			);
		}

		return text;
	}

	/**
	 * @param value A value from a caller.
	 * @param field The field name, used in the refusal.
	 * @returns The value as an exact decimal string.
	 * @throws BadRequestException when the value is not a decimal number.
	 */
	private readDecimal(value: number | string, field: string): string {
		const text = typeof value === 'number' ? String(value) : `${value ?? ''}`.trim();

		if (text === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) {
			throw new BadRequestException(`ORDER_LINE_REFUND_INVALID: ${field} "${text}" is not a decimal number.`);
		}

		return text;
	}
}
