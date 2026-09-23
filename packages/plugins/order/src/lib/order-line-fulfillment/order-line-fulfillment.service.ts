import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, addDecimalStrings, compareDecimalStrings, normalizeDecimalString } from '@gauzy/core';
import { IOrderLineFulfillment, IOrderLineReceiptMove } from '../order.types';
import { Order } from '../order/order.entity';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderLine } from '../order-line/order-line.entity';
import { TypeOrmOrderLineRepository } from '../order-line/repository/type-orm-order-line.repository';

/**
 * The fulfilled quantities of an order, read from the order's own columns.
 *
 * A post-purchase flow — a return, a claim, an exchange — may only act on what was actually
 * fulfilled, and only this package knows that number: it is the `fulfilledQuantity` counter the
 * fulfilment rows maintain, which is the sum of the line's fulfilments that were never cancelled.
 * Two writers of that number would be two answers to "how much of this line left the building", so
 * the counter is read here and never recomputed from a shipment: the caller states which order
 * line it is asking about, and this service answers with the line's ceiling and the price the line
 * was sold at.
 *
 * Three properties are deliberate:
 *
 * 1. **Only lines with something fulfilled are reported.** The report is the set of lines a
 *    post-purchase flow may act on, so a line that was never fulfilled is absent from it. That is
 *    the honest answer to "can this be returned?": the caller's map lookup fails, and the flow
 *    refuses with "this was never fulfilled" rather than with an arithmetic comparison against a
 *    zero it would have to special-case.
 * 2. **Both numbers are exact decimals.** The quantity is the column's exact decimal text, never a
 *    floating-point number — a ceiling compared in floating point is wrong exactly at its boundary,
 *    which is where a return of the last available unit sits. The price is read through the
 *    platform money layer, so it is the price the ledger would also compute, at the storage scale.
 * 3. **The read is scoped to the caller's tenant and organization**, like every other read of this
 *    package. An order that is not the caller's is not found, which is the same answer whether it
 *    does not exist or belongs to somebody else.
 *
 * The class owns no table and no rule of its own: it is the seam through which a package that does
 * not own the order reaches the two facts it needs about one — what a line has shipped, which is the
 * ceiling it is measured against, and what came back, which is what the derivation decides the
 * order's fulfilment status from — and it exists so that no other package ever reads **or writes**
 * `order_line`.
 */
@Injectable()
export class OrderLineFulfillmentService {
	constructor(
		readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository
	) {}

	/**
	 * Reads what each line of an order has fulfilled, and at what price it was sold.
	 *
	 * @param orderId The order to read.
	 * @returns One entry per line that has something fulfilled, in the order the lines are presented
	 * in. A line that was never fulfilled is absent.
	 * @throws BadRequestException when no order was named.
	 * @throws NotFoundException when the order is not the caller's, which is also the answer for an
	 * order that does not exist.
	 */
	public async getFulfilledLines(orderId: ID): Promise<IOrderLineFulfillment[]> {
		if (!orderId) {
			throw new BadRequestException(
				'ORDER_FULFILLMENT_ORDER_REQUIRED: the fulfilled quantities of an order are read for one named order.'
			);
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const order = await this.typeOrmOrderRepository.findOne({
			where: { id: orderId, tenantId, organizationId } as FindOptionsWhere<Order>
		});

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const lines = await this.typeOrmOrderLineRepository.find({
			where: { orderId, tenantId, organizationId } as FindOptionsWhere<OrderLine>,
			order: { position: 'ASC' }
		});

		const fulfilled: IOrderLineFulfillment[] = [];

		for (const line of lines ?? []) {
			const quantity = this.quantityOf(line.fulfilledQuantity);

			// A presentation row — a section heading or a note — carries no quantity and no price, and
			// a real line that never shipped carries a zero: neither is something a post-purchase flow
			// may act on, and both are therefore absent from the report rather than reported as zero.
			if (compareDecimalStrings(quantity, '0') <= 0) {
				continue;
			}

			fulfilled.push({
				orderLineId: line.id,
				...(line.variantId ? { variantId: line.variantId } : {}),
				fulfilledQuantity: quantity,
				unitPrice: Money.fromStorage(line.unitPrice, order.currency as CurrencyCode).toStorageString()
			});
		}

		return fulfilled;
	}

	/**
	 * Reads a quantity column as an exact decimal.
	 *
	 * The counter is a `numeric(20,6)` read through the platform's numeric transformer, so it
	 * arrives as the value the transformer produced. Normalising it is not an arithmetic step: it
	 * turns that value into the canonical decimal text the contract promises, and it refuses a value
	 * that is not an exact decimal instead of handing the caller something its own parser would have
	 * to guess at.
	 *
	 * @param value The stored quantity.
	 * @returns The quantity as an exact decimal string.
	 */
	private quantityOf(value: number | DecimalString | null | undefined): DecimalString {
		return normalizeDecimalString(value ?? 0);
	}

	/**
	 * Moves the received-return counter of an order's lines.
	 *
	 * **This is the writer `order_line.returnReceivedQuantity` never had.** The column is read by
	 * `deriveFulfillmentStatus`, which decides `PARTIALLY_RETURNED` and `RETURNED` from it — and until
	 * this method existed, nothing in the repository assigned it: the three counters beside it are
	 * written by `OrderChangeService.applyAction`, and this one was written by nobody, so the
	 * derivation could never see goods come back and doc 10 §11.6 step 2 ("order line
	 * `returnReceivedQuantity` updated") described an update that did not happen. A sweep of every
	 * `.ts` in `packages/` and `apps/` found the name in the migrations, the contract, the entity, the
	 * SDL, one read in the derivation and one assignment **in a test fixture**.
	 *
	 * **It is a move, not a set.** The counter is the order's cache of what came back, so a delivery
	 * increases it by the units it brought and the receipt's compensation decreases it by the same
	 * units. A caller stating an absolute value would be stating a fact it does not own — the counter
	 * is the sum over every live return of that order line — and two deliveries in flight would
	 * overwrite one another.
	 *
	 * **Three things are refused rather than written through**, because each would leave the order's
	 * cache disagreeing with the goods it describes: an order or a line that is not the caller's (the
	 * same scoped read the reader above performs, so a foreign line is not found at all), and a move
	 * that would take the counter below zero — a negative "received" is not a state the column can be
	 * in, and a compensation that overshot would otherwise write one. A delta that is not written as a
	 * decimal is refused by the money layer rather than here.
	 *
	 * @param orderId The order whose lines are moved, and the scope the write is checked in.
	 * @param moves One entry per order line this delivery touched. An empty list moves nothing.
	 * @throws BadRequestException when no order was named, or a move would take a counter below zero.
	 * @throws NotFoundException when the order, or a named line of it, is not the caller's.
	 */
	public async recordReturnReceipt(orderId: ID, moves: readonly IOrderLineReceiptMove[]): Promise<void> {
		if (!orderId) {
			throw new BadRequestException(
				'ORDER_FULFILLMENT_ORDER_REQUIRED: the received-return counter of an order is moved for one named order.'
			);
		}

		if (!moves || moves.length === 0) {
			return;
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const order = await this.typeOrmOrderRepository.findOne({
			where: { id: orderId, tenantId, organizationId } as FindOptionsWhere<Order>
		});

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		for (const move of moves) {
			const line = await this.typeOrmOrderLineRepository.findOne({
				where: { id: move.orderLineId, orderId, tenantId, organizationId } as FindOptionsWhere<OrderLine>
			});

			if (!line) {
				throw new NotFoundException(
					`ORDER_LINE_NOT_FOUND: order ${orderId} has no line ${move.orderLineId} in this organization.`
				);
			}

			const received = addDecimalStrings(this.quantityOf(line.returnReceivedQuantity), move.quantityDelta);

			if (compareDecimalStrings(received, '0') < 0) {
				throw new BadRequestException(
					`ORDER_LINE_RECEIPT_BELOW_ZERO: moving line ${move.orderLineId} by ${move.quantityDelta} would ` +
						`leave ${received} units received, and a line cannot have received less than nothing.`
				);
			}

			await this.typeOrmOrderLineRepository.update(line.id, { returnReceivedQuantity: received } as never);
		}
	}
}
