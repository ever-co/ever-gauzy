import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import {
	FulfillmentDirection,
	FulfillmentStatusDetail,
	ID,
	IOrderLine,
	IPagination
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderLineService } from '@gauzy/plugin-order';
import { Fulfillment } from './fulfillment.entity';
import { TypeOrmFulfillmentRepository } from './repository/type-orm-fulfillment.repository';
import { MikroOrmFulfillmentRepository } from './repository/mikro-orm-fulfillment.repository';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';

/** The transitions the fulfilment lifecycle allows, and nothing else. */
const ALLOWED_TRANSITIONS: Record<FulfillmentStatusDetail, FulfillmentStatusDetail[]> = {
	[FulfillmentStatusDetail.PENDING]: [
		FulfillmentStatusDetail.SHIPPED,
		FulfillmentStatusDetail.CANCELED
	],
	[FulfillmentStatusDetail.SHIPPED]: [
		FulfillmentStatusDetail.IN_TRANSIT,
		FulfillmentStatusDetail.DELIVERED,
		FulfillmentStatusDetail.CANCELED
	],
	[FulfillmentStatusDetail.IN_TRANSIT]: [FulfillmentStatusDetail.DELIVERED],
	[FulfillmentStatusDetail.DELIVERED]: [],
	[FulfillmentStatusDetail.CANCELED]: []
};

/**
 * Shipments against orders.
 *
 * The lifecycle is owned here, in one place, because it is the reason the table exists: **a delivered
 * fulfilment is never cancelled** — a return is created instead, as a fulfilment whose direction is
 * `RETURN` — and a status only ever moves forward. A service that could write a status directly would
 * make that rule a convention rather than an invariant.
 *
 * Quantity is checked against what the order line has **left**, not against what was ordered: a second
 * partial shipment of the same line is a second fulfilment, and the order line's own counters are the
 * authority on how much is outstanding. Those counters are maintained by the line service, in the same
 * transaction as the row that causes them.
 */
@Injectable()
export class FulfillmentService extends TenantAwareCrudService<Fulfillment> {
	constructor(
		readonly typeOrmFulfillmentRepository: TypeOrmFulfillmentRepository,
		readonly mikroOrmFulfillmentRepository: MikroOrmFulfillmentRepository,
		private readonly lineService: FulfillmentLineService,
		private readonly orderLineService: OrderLineService
	) {
		super(typeOrmFulfillmentRepository, mikroOrmFulfillmentRepository);
	}

	/**
	 * Creates a fulfilment and its lines.
	 *
	 * Stock is not touched here: consuming the reservations and writing the movements through the sale
	 * ledger is the inventory package's write path, and it runs in the same transaction as this call.
	 * What this method guarantees is that the quantities are legal against the order — the precondition
	 * the stock movement depends on.
	 *
	 * @param entity The fulfilment, with its lines.
	 * @returns The created fulfilment, with its lines.
	 */
	public async create(entity: DeepPartial<Fulfillment>): Promise<Fulfillment> {
		const lines = (entity as { lines?: DeepPartial<FulfillmentLine>[] }).lines ?? [];

		if (lines.length === 0) {
			throw new BadRequestException('FULFILLMENT_EMPTY: a fulfilment needs at least one line.');
		}

		for (const line of lines) {
			await this.assertQuantityAvailable(
				line.orderLineId as ID,
				Number(line.quantity),
				entity.direction ?? FulfillmentDirection.OUTBOUND
			);
		}

		const fulfillment = await super.create({
			...entity,
			direction: entity.direction ?? FulfillmentDirection.OUTBOUND,
			status: FulfillmentStatusDetail.PENDING,
			version: 1
		} as DeepPartial<Fulfillment>);

		for (const line of lines) {
			await this.lineService.create({ ...line, fulfillmentId: fulfillment.id } as DeepPartial<FulfillmentLine>);
			await this.bumpOrderLineCounters(line.orderLineId as ID, Number(line.quantity), 'FULFILLED');
		}

		return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
	}

	/**
	 * Marks a fulfilment as handed to the carrier.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param details The tracking details the carrier returned.
	 * @returns The shipped fulfilment.
	 */
	public async ship(
		fulfillmentId: ID,
		details: { trackingNumber?: string; carrier?: string; service?: string; noNotification?: boolean } = {}
	): Promise<Fulfillment> {
		const fulfillment = await this.transition(fulfillmentId, FulfillmentStatusDetail.SHIPPED);
		const lines = ((await this.lineService.findAll({
			where: { fulfillmentId }
		})) as IPagination<FulfillmentLine>).items;

		for (const line of lines) {
			await this.bumpOrderLineCounters(line.orderLineId, Number(line.quantity), 'SHIPPED');
		}

		await this.update(fulfillment.id, {
			trackingNumber: details.trackingNumber ?? fulfillment.trackingNumber,
			carrier: details.carrier ?? fulfillment.carrier,
			service: details.service ?? fulfillment.service,
			noNotification: details.noNotification ?? fulfillment.noNotification,
			shippedAt: new Date()
		} as any);

		return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
	}

	/**
	 * Marks a fulfilment as moving, without changing what has shipped.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @returns The updated fulfilment.
	 */
	public async markInTransit(fulfillmentId: ID): Promise<Fulfillment> {
		return this.transition(fulfillmentId, FulfillmentStatusDetail.IN_TRANSIT);
	}

	/**
	 * Marks a fulfilment as delivered.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param deliveredAt When the carrier reported delivery.
	 * @returns The delivered fulfilment.
	 */
	public async deliver(fulfillmentId: ID, deliveredAt?: Date): Promise<Fulfillment> {
		const fulfillment = await this.transition(fulfillmentId, FulfillmentStatusDetail.DELIVERED);
		const lines = ((await this.lineService.findAll({
			where: { fulfillmentId }
		})) as IPagination<FulfillmentLine>).items;

		for (const line of lines) {
			await this.bumpOrderLineCounters(line.orderLineId, Number(line.quantity), 'DELIVERED');
		}

		await this.update(fulfillment.id, { deliveredAt: deliveredAt ?? new Date() } as any);

		return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
	}

	/**
	 * Cancels a fulfilment that has not been delivered.
	 *
	 * The quantities go back to the order line, because a cancelled shipment no longer accounts for
	 * them; re-creating the stock reservations is the inventory package's compensation for the same
	 * event.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled fulfilment.
	 */
	public async cancel(fulfillmentId: ID, reason?: string): Promise<Fulfillment> {
		const fulfillment = await this.transition(fulfillmentId, FulfillmentStatusDetail.CANCELED);
		const lines = ((await this.lineService.findAll({
			where: { fulfillmentId }
		})) as IPagination<FulfillmentLine>).items;

		for (const line of lines) {
			await this.bumpOrderLineCounters(line.orderLineId, -Number(line.quantity), 'FULFILLED');

			if (fulfillment.status === FulfillmentStatusDetail.SHIPPED) {
				await this.bumpOrderLineCounters(line.orderLineId, -Number(line.quantity), 'SHIPPED');
			}
		}

		await this.update(fulfillment.id, {
			canceledAt: new Date(),
			metadata: { ...(fulfillment.metadata ?? {}), cancelReason: reason }
		} as any);

		return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
	}

	/**
	 * Moves a fulfilment to a status, or refuses with the allowed set.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param to The requested status.
	 * @returns The fulfilment, with its optimistic lock bumped.
	 */
	public async transition(fulfillmentId: ID, to: FulfillmentStatusDetail): Promise<Fulfillment> {
		const fulfillment = await this.findOneByIdString(fulfillmentId);

		if (!fulfillment) {
			throw new NotFoundException(`FULFILLMENT_NOT_FOUND: no fulfilment exists with id ${fulfillmentId}.`);
		}

		if (fulfillment.status === to) {
			return fulfillment;
		}

		if (!ALLOWED_TRANSITIONS[fulfillment.status].includes(to)) {
			throw new BadRequestException({
				message: `A ${fulfillment.status} fulfilment cannot move to ${to}.`,
				code: 'FULFILLMENT_STATUS_TRANSITION_INVALID',
				details: { from: fulfillment.status, to, allowed: ALLOWED_TRANSITIONS[fulfillment.status] }
			});
		}

		await this.update(fulfillment.id, {
			status: to,
			version: Number(fulfillment.version ?? 1) + 1
		} as any);

		return this.findOneByIdString(fulfillment.id);
	}

	/**
	 * The quantity of an order line that may still go into a fulfilment.
	 *
	 * @param orderLineId The order line.
	 * @returns The outstanding quantity.
	 */
	public async outstandingOf(orderLineId: ID): Promise<number> {
		const line = await this.orderLineService.findOneByIdString(orderLineId);

		if (!line) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${orderLineId}.`);
		}

		return (
			Number(line.quantity) -
			Number(line.writtenOffQuantity) -
			Number(line.returnDismissedQuantity) -
			Number(line.fulfilledQuantity)
		);
	}

	/**
	 * Refuses a shipment of more than the order line has left.
	 *
	 * A return shipment is exempt: returning more than is outstanding is a credit decision the returns
	 * package makes, not a shipping constraint this one imposes.
	 *
	 * @param orderLineId The order line.
	 * @param quantity The quantity being shipped.
	 * @param direction The direction of the shipment.
	 */
	private async assertQuantityAvailable(
		orderLineId: ID,
		quantity: number,
		direction: FulfillmentDirection
	): Promise<void> {
		if (quantity <= 0) {
			throw new BadRequestException('FULFILLMENT_LINE_QUANTITY_INVALID: a shipment quantity is positive.');
		}

		if (direction === FulfillmentDirection.RETURN) {
			return;
		}

		const outstanding = await this.outstandingOf(orderLineId);

		if (quantity > outstanding) {
			throw new BadRequestException({
				message: 'The shipment would exceed what the order line still has to ship.',
				code: 'FULFILLMENT_QUANTITY_EXCEEDED',
				details: { orderLineId, requested: quantity, outstanding }
			});
		}
	}

	/**
	 * Adds a delta to one of an order line's quantity counters.
	 *
	 * The counters are caches of the fulfilment lines, which is why they are written here and only here:
	 * a second writer would be a second opinion about how much of a line has shipped.
	 *
	 * @param orderLineId The order line.
	 * @param delta The signed quantity.
	 * @param counter Which counter to move.
	 */
	private async bumpOrderLineCounters(
		orderLineId: ID,
		delta: number,
		counter: 'FULFILLED' | 'SHIPPED' | 'DELIVERED'
	): Promise<void> {
		const line: IOrderLine = await this.orderLineService.findOneByIdString(orderLineId);

		if (!line) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${orderLineId}.`);
		}

		const changes: Record<string, number> = {};

		switch (counter) {
			case 'FULFILLED':
				changes['fulfilledQuantity'] = Math.max(0, Number(line.fulfilledQuantity) + delta);
				break;
			case 'SHIPPED':
				changes['shippedQuantity'] = Math.max(0, Number(line.shippedQuantity) + delta);
				break;
			case 'DELIVERED':
				changes['deliveredQuantity'] = Math.max(0, Number(line.deliveredQuantity) + delta);
				break;
		}

		await this.orderLineService.update(orderLineId, changes as any);
	}
}
