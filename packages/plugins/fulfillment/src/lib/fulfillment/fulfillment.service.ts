import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { DeepPartial, FindManyOptions } from 'typeorm';
import {
	FulfillmentDirection,
	FulfillmentStatusDetail,
	ID,
	IOrderLine,
	IPagination
} from '@gauzy/contracts';
import {
	IVersionExpectation,
	RequestContext,
	TenantAwareCrudService,
	commitVersionedUpdate,
	compareDecimalStrings
} from '@gauzy/core';
import { OrderLineService } from '@gauzy/plugin-order';
import { Fulfillment } from './fulfillment.entity';
import { TypeOrmFulfillmentRepository } from './repository/type-orm-fulfillment.repository';
import { MikroOrmFulfillmentRepository } from './repository/mikro-orm-fulfillment.repository';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { addQuantities, isNegativeQuantity, isPositiveQuantity, remainingQuantity } from '../fulfillment.quantity';
import { FULFILLMENT_LABEL_PROVIDER, IFulfillmentLabelProviderPort } from '../fulfillment.types';

/**
 * The transitions the fulfilment lifecycle allows, and nothing else.
 *
 * `CANCELED` is reachable from `PENDING` only: goods that have left are handled by a return, never by
 * a cancelation, so a `SHIPPED` parcel is not un-shipped (doc 09 §12.9).
 */
const ALLOWED_TRANSITIONS: Record<FulfillmentStatusDetail, FulfillmentStatusDetail[]> = {
	[FulfillmentStatusDetail.PENDING]: [
		FulfillmentStatusDetail.SHIPPED,
		FulfillmentStatusDetail.CANCELED
	],
	[FulfillmentStatusDetail.SHIPPED]: [
		FulfillmentStatusDetail.IN_TRANSIT,
		FulfillmentStatusDetail.DELIVERED
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
 *
 * Every quantity on that path is an exact decimal and is computed as one — the remainder, the
 * comparison against it and the counters themselves all go through `fulfillment.quantity.ts` — because
 * a partial shipment of a measured good lands exactly on a boundary that binary floating point cannot
 * represent.
 *
 * One capability is reached through a port rather than implemented here, because it belongs to the
 * carrier: the label a shipment travels with is issued by a provider this domain does not own. The
 * port is injected optionally — an installation with no carrier integration records tracking by hand —
 * and a request for a label that cannot be answered is refused loudly rather than invented. Every
 * write of a fulfilment that a caller conditions on a version goes through `commitVersionedUpdate`, so
 * the columns and the version move in one statement.
 */
@Injectable()
export class FulfillmentService extends TenantAwareCrudService<Fulfillment> {
	constructor(
		readonly typeOrmFulfillmentRepository: TypeOrmFulfillmentRepository,
		readonly mikroOrmFulfillmentRepository: MikroOrmFulfillmentRepository,
		private readonly lineService: FulfillmentLineService,
		private readonly orderLineService: OrderLineService,
		@Optional()
		@Inject(FULFILLMENT_LABEL_PROVIDER)
		private readonly labelProvider?: IFulfillmentLabelProviderPort
	) {
		super(typeOrmFulfillmentRepository, mikroOrmFulfillmentRepository);
	}

	/**
	 * Lists fulfilments without the carrier's label payload.
	 *
	 * A page of shipments is a list of journeys, and the label payload is a document: it is the
	 * provider's own body, it is as large as the provider chose to make it, and no list view renders
	 * it. Projecting it out here rather than at each caller is what keeps the rule in one place — the
	 * collection read of both protocols narrows through this method, so neither can start answering
	 * with a payload the other withholds.
	 *
	 * `labelUrl` stays. It is one address, it is what a list actually shows, and the read of one
	 * fulfilment answers both members in full — which is where a caller that needs the document goes.
	 *
	 * @param options The query options.
	 * @returns A page of fulfilments, each without its label payload.
	 */
	public async findAll(options: FindManyOptions<Fulfillment> = {}): Promise<IPagination<Fulfillment>> {
		const page = await super.findAll(options);

		return { ...page, items: page.items.map((fulfillment) => this.withoutLabelPayload(fulfillment)) };
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
	 * Raises the leg the goods come back on.
	 *
	 * A return is a fulfilment whose direction is `RETURN`, and it is raised here rather than by the
	 * domain that decided on it, because a shipment is this domain's row and its lifecycle is this
	 * domain's rule. What it deliberately does **not** carry is lines, and that is the one place the
	 * two creation paths differ:
	 *
	 * - **Nothing is picked for a return.** The lines of an outbound fulfilment are what a picking
	 *   list is derived from and what the order line's counters are moved by, which is why `create`
	 *   refuses a fulfilment with none. Goods coming back are not fetched from a bin: they arrive, and
	 *   the quantity that arrived is recorded by the domain that received it, against its own lines.
	 * - **The order line's counters must not move.** A return does not fulfil anything, so writing
	 *   `fulfilledQuantity` for it would count the same units twice — once when they went out and once
	 *   when they came back — and every later check measured against that counter would be wrong.
	 *
	 * The leg therefore starts `PENDING` at version one, like any other shipment, and moves through
	 * the same lifecycle as any other: what has not moved cannot be delivered, and a leg that is
	 * abandoned before anything was handed over is cancelled rather than deleted.
	 *
	 * The tenant and the organization are stamped from the request context rather than taken from the
	 * caller: the leg belongs to whoever raised it, and a caller that could state another scope could
	 * write a shipment its own reads would never find again.
	 *
	 * @param entity The leg to raise: the order the goods came from, and whatever else is already
	 * known about the journey.
	 * @returns The raised leg, pending.
	 * @throws BadRequestException when no order was named.
	 */
	public async createReturnLeg(entity: {
		orderId: ID;
		warehouseId?: ID;
		trackingNumber?: string;
		carrier?: string;
		service?: string;
		providerId?: string;
		metadata?: Record<string, unknown>;
	}): Promise<Fulfillment> {
		if (!entity?.orderId) {
			throw new BadRequestException(
				'FULFILLMENT_ORDER_REQUIRED: a return leg is raised against the order its goods came from.'
			);
		}

		return await super.create({
			...entity,
			direction: FulfillmentDirection.RETURN,
			status: FulfillmentStatusDetail.PENDING,
			requiresShipping: true,
			version: 1,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as DeepPartial<Fulfillment>);
	}

	/**
	 * Marks a fulfilment as handed to the carrier.
	 *
	 * Handing the same parcel over twice is not a second hand-over, and it is refused rather than
	 * absorbed: the counters below are a cache of the shipment lines that caused them, so a repeat
	 * would count the same units again (doc 06 §6.9, `409 FULFILLMENT_ALREADY_SHIPPED`).
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param details The tracking details the carrier returned.
	 * @returns The shipped fulfilment.
	 */
	public async ship(
		fulfillmentId: ID,
		details: { trackingNumber?: string; carrier?: string; service?: string; noNotification?: boolean } = {}
	): Promise<Fulfillment> {
		const { fulfillment, moved } = await this.move(fulfillmentId, FulfillmentStatusDetail.SHIPPED);

		if (!moved) {
			throw new ConflictException({
				message: `FULFILLMENT_ALREADY_SHIPPED: fulfillment '${fulfillmentId}' is already shipped.`,
				code: 'FULFILLMENT_ALREADY_SHIPPED',
				details: { fulfillmentId, status: fulfillment.status }
			});
		}

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
	 * Delivery is reported rather than requested, so a carrier that reports it twice has not delivered
	 * the goods twice: the repeat answers the resource it already has, and the counters below are not
	 * moved a second time. Only a hand-over that actually happened is counted.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param deliveredAt When the carrier reported delivery.
	 * @returns The delivered fulfilment.
	 */
	public async deliver(fulfillmentId: ID, deliveredAt?: Date): Promise<Fulfillment> {
		const { fulfillment, moved } = await this.move(fulfillmentId, FulfillmentStatusDetail.DELIVERED);

		if (!moved) {
			return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
		}

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
	 * Cancels a fulfilment that has not been handed over, or answers the one already cancelled.
	 *
	 * The cancelation matrix of doc 09 §12.9 permits a cancelation from `PENDING` only: `SHIPPED`,
	 * `IN_TRANSIT` and `DELIVERED` are refused with `FULFILLMENT_NOT_CANCELABLE`, because goods that
	 * have left are handled by a return (`direction = RETURN`) rather than by an un-shipment. A
	 * repeat submission of a cancelation is the documented no-op — `200` with the unchanged resource —
	 * so it moves no counter: the quantities below go back to the order line once, whatever the
	 * caller submits.
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
		const current = await this.findOneByIdString(fulfillmentId);

		if (current.status === FulfillmentStatusDetail.CANCELED) {
			return this.findOneByIdString(current.id, { relations: ['lines'] });
		}

		if (current.status !== FulfillmentStatusDetail.PENDING) {
			throw new ConflictException({
				message: `FULFILLMENT_NOT_CANCELABLE: fulfillment '${fulfillmentId}' can no longer be canceled: it is ${current.status}.`,
				code: 'FULFILLMENT_NOT_CANCELABLE',
				details: { fulfillmentId, status: current.status, cancelableFrom: [FulfillmentStatusDetail.PENDING] }
			});
		}

		const fulfillment = await this.transition(fulfillmentId, FulfillmentStatusDetail.CANCELED);
		const lines = ((await this.lineService.findAll({
			where: { fulfillmentId }
		})) as IPagination<FulfillmentLine>).items;

		for (const line of lines) {
			await this.bumpOrderLineCounters(line.orderLineId, -Number(line.quantity), 'FULFILLED');
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
	 * A move to the status the row already holds writes nothing and answers the row unchanged, so the
	 * machine itself is idempotent; what that means for the counters a caller moves beside it is
	 * decided by the caller, through the `moved` flag of `move`.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param to The requested status.
	 * @returns The fulfilment, with its optimistic lock bumped when it moved.
	 */
	public async transition(fulfillmentId: ID, to: FulfillmentStatusDetail): Promise<Fulfillment> {
		return (await this.move(fulfillmentId, to)).fulfillment;
	}

	/**
	 * Requests a carrier label for a shipment, or asks the carrier for the label it already issued.
	 *
	 * **The two cases are one call.** A carrier answers a request for a label it has already issued
	 * with the document it holds for that tracking number rather than by issuing a second one, so the
	 * domain cannot tell a first request from a re-fetch and does not try to: what it writes is what
	 * the provider answered, and the version-predicated update is what makes the write safe to repeat.
	 * A retry that carries the same `Idempotency-Key` never reaches here at all — the kernel replays
	 * the first answer — and a re-fetch that carries a fresh key is an ordinary call that lands on the
	 * same two columns.
	 *
	 * **A label needs a parcel the carrier has taken.** The tracking number is the number the carrier
	 * issued when it took the goods, so a shipment that carries none has not been handed over, and a
	 * label for it is a request no carrier can answer. It is refused with the code this package already
	 * raises for a shipment that has not departed, rather than by asking a provider about a parcel it
	 * has never seen and reporting whatever it says.
	 *
	 * **An installation with no carrier integration is refused, not guessed at.** The provider is
	 * reached through a port, and a deployment that registered none cannot produce a label for any
	 * shipment; the answer is the code the API specification already assigns to that, so an operator
	 * learns that the integration is missing rather than that this parcel is special.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param request The carrier strategy, and the service level when the caller restates it.
	 * @param expectation The version the caller read the fulfilment at, which the write is predicated
	 * on.
	 * @returns The fulfilment with its label recorded and its version moved on.
	 * @throws NotFoundException when the fulfilment is not the caller's, which is also the answer for
	 * one that does not exist.
	 * @throws BadRequestException with `SHIPMENT_NOT_DEPARTED` when the fulfilment carries no tracking
	 * number.
	 * @throws BadGatewayException with `FULFILLMENT_LABEL_UNAVAILABLE` when no carrier label provider
	 * is registered in this installation.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the fulfilment moved on since it was
	 * read.
	 */
	public async requestLabel(
		fulfillmentId: ID,
		request: { providerId: string; service?: string },
		expectation: IVersionExpectation
	): Promise<Fulfillment> {
		const fulfillment = await this.findOneByIdString(fulfillmentId);

		if (!fulfillment) {
			throw new NotFoundException(`FULFILLMENT_NOT_FOUND: no fulfilment exists with id ${fulfillmentId}.`);
		}

		if (!fulfillment.trackingNumber) {
			throw new BadRequestException({
				message: `SHIPMENT_NOT_DEPARTED: fulfillment '${fulfillmentId}' carries no tracking number, so no carrier has taken the parcel and no label can be requested for it.`,
				code: 'SHIPMENT_NOT_DEPARTED',
				details: { fulfillmentId, status: fulfillment.status }
			});
		}

		if (!this.labelProvider) {
			throw new BadGatewayException({
				message: `FULFILLMENT_LABEL_UNAVAILABLE: no carrier label provider is registered in this installation, so no shipping label is available for fulfillment '${fulfillmentId}'.`,
				code: 'FULFILLMENT_LABEL_UNAVAILABLE',
				details: { fulfillmentId, providerId: request?.providerId }
			});
		}

		const label = await this.labelProvider.requestLabel({
			fulfillmentId: fulfillment.id,
			orderId: fulfillment.orderId,
			providerId: request.providerId,
			trackingNumber: fulfillment.trackingNumber,
			service: request.service ?? fulfillment.service,
			carrier: fulfillment.carrier,
			direction: fulfillment.direction,
			warehouseId: fulfillment.warehouseId
		});

		// The label and the version increment are one statement, so a caller that read the shipment and
		// a carrier that labelled it cannot both be right about the row: whichever loses is answered
		// with the conflict and re-reads.
		await commitVersionedUpdate<Fulfillment>(this, {
			id: fulfillment.id,
			expectation,
			patch: { labelUrl: label.labelUrl, labelData: label.labelData },
			where: {
				...(fulfillment.tenantId ? { tenantId: fulfillment.tenantId } : {}),
				...(fulfillment.organizationId ? { organizationId: fulfillment.organizationId } : {})
			}
		});

		return this.findOneByIdString(fulfillment.id, { relations: ['lines'] });
	}

	/**
	 * The quantity of an order line that may still go into a fulfilment.
	 *
	 * @param orderLineId The order line.
	 * @returns The outstanding quantity.
	 */
	public async outstandingOf(orderLineId: ID): Promise<number> {
		return Number(await this.outstandingQuantityTextOf(orderLineId));
	}

	/**
	 * Moves a fulfilment to a status and reports whether it actually moved.
	 *
	 * The lifecycle is owned here, in one place, and the flag is what lets the callers that move a
	 * counter beside the status tell "the row is now the target" from "the row was already the
	 * target" — a distinction that is invisible to a caller reading only the moved row.
	 *
	 * @param fulfillmentId The fulfilment.
	 * @param to The requested status.
	 * @returns The fulfilment, and whether the move happened.
	 */
	private async move(
		fulfillmentId: ID,
		to: FulfillmentStatusDetail
	): Promise<{ fulfillment: Fulfillment; moved: boolean }> {
		const fulfillment = await this.findOneByIdString(fulfillmentId);

		if (!fulfillment) {
			throw new NotFoundException(`FULFILLMENT_NOT_FOUND: no fulfilment exists with id ${fulfillmentId}.`);
		}

		if (fulfillment.status === to) {
			return { fulfillment, moved: false };
		}

		if (!ALLOWED_TRANSITIONS[fulfillment.status].includes(to)) {
			throw new BadRequestException({
				message: `A ${fulfillment.status} fulfilment cannot move to ${to}.`,
				code: 'FULFILLMENT_STATUS_TRANSITION_INVALID',
				details: { from: fulfillment.status, to, allowed: ALLOWED_TRANSITIONS[fulfillment.status] }
			});
		}

		// The status and the version move in one statement, predicated on the version this read saw.
		//
		// Computing the next version here and writing it through the generic update made the transition
		// check the only thing standing between two callers: both read the same row, both passed the check
		// against the same status, and whichever wrote second silently erased the first — with a version
		// number that said nothing about what it had overwritten. The conditional write refuses that
		// second caller with the conflict instead, and `version` is set by the helper, not here.
		await commitVersionedUpdate<Fulfillment>(this, {
			id: fulfillment.id,
			expectation: { wildcard: false, versions: [Number(fulfillment.version ?? 1)] },
			patch: { status: to },
			where: {
				...(fulfillment.tenantId ? { tenantId: fulfillment.tenantId } : {}),
				...(fulfillment.organizationId ? { organizationId: fulfillment.organizationId } : {})
			}
		});

		return { fulfillment: await this.findOneByIdString(fulfillment.id), moved: true };
	}

	/**
	 * The quantity of an order line that may still go into a fulfilment, as exact decimal text.
	 *
	 * The subtraction is the one doc 09 §12.6 states, made on the digits of the decimals rather than
	 * on their floating point approximations, and it is answered as text because a `numeric(20,6)`
	 * carries more significant digits than a double: the guard that compares a requested quantity
	 * against this remainder is exact only while the remainder is still its own digits.
	 *
	 * @param orderLineId The order line.
	 * @returns The outstanding quantity, as decimal text.
	 */
	private async outstandingQuantityTextOf(orderLineId: ID): Promise<string> {
		const line = await this.orderLineService.findOneByIdString(orderLineId);

		if (!line) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${orderLineId}.`);
		}

		return remainingQuantity(
			line.quantity,
			line.writtenOffQuantity,
			line.returnDismissedQuantity,
			line.fulfilledQuantity
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
		// The requirement is a quantity, and a quantity greater than zero: `NaN` and the infinities are
		// not quantities, and the comparison this guard used to be written as is false for all of them.
		if (!isPositiveQuantity(quantity)) {
			throw new BadRequestException('FULFILLMENT_LINE_QUANTITY_INVALID: a shipment quantity is positive.');
		}

		if (direction === FulfillmentDirection.RETURN) {
			return;
		}

		const outstanding = await this.outstandingQuantityTextOf(orderLineId);

		// Compared as decimals rather than as numbers, so that a request for exactly the remainder is
		// accepted even when the remainder has no exact binary representation.
		if (compareDecimalStrings(quantity, outstanding) > 0) {
			throw new BadRequestException({
				message: 'The shipment would exceed what the order line still has to ship.',
				code: 'FULFILLMENT_QUANTITY_EXCEEDED',
				details: { orderLineId, requested: quantity, outstanding: Number(outstanding) }
			});
		}
	}

	/**
	 * Adds a delta to one of an order line's quantity counters.
	 *
	 * The counters are caches of the fulfilment lines, which is why they are written here and only here:
	 * a second writer would be a second opinion about how much of a line has shipped. The addition is
	 * exact for the same reason the remainder above is: a counter that drifted by a rounding error
	 * would make every later remainder wrong in the same direction.
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

		/** The counter after the move, which a cancelation may take to zero but never below. */
		const moved = (current: number): number => {
			const total = addQuantities(current, delta);

			return isNegativeQuantity(total) ? 0 : Number(total);
		};

		const changes: Record<string, number> = {};

		switch (counter) {
			case 'FULFILLED':
				changes['fulfilledQuantity'] = moved(line.fulfilledQuantity);
				break;
			case 'SHIPPED':
				changes['shippedQuantity'] = moved(line.shippedQuantity);
				break;
			case 'DELIVERED':
				changes['deliveredQuantity'] = moved(line.deliveredQuantity);
				break;
		}

		await this.orderLineService.update(orderLineId, changes as any);
	}

	/**
	 * One fulfilment without the carrier's label payload.
	 *
	 * The copy is deliberate: the row the caller holds is the one the list read answered with, and
	 * deleting a member from it would edit a record another caller may still be reading. A fulfilment
	 * that holds no payload is answered as it stands, because there is nothing to withhold.
	 *
	 * @param fulfillment The fulfilment, as it was read.
	 * @returns The fulfilment without its label payload.
	 */
	private withoutLabelPayload(fulfillment: Fulfillment): Fulfillment {
		if (fulfillment?.labelData === null || fulfillment?.labelData === undefined) {
			return fulfillment;
		}

		const { labelData, ...rest } = fulfillment;
		void labelData;

		return rest as Fulfillment;
	}
}
