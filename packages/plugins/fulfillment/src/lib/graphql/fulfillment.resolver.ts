import { Args, Context, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import {
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import {
	FULFILLMENT_DIRECTIONS,
	FULFILLMENT_STATUS_DETAILS,
	isFulfillmentDirection,
	isFulfillmentStatusDetail
} from './filters';
import { IFulfillmentConnection } from './types';

/**
 * The fulfilment root fields and the shipment's own transitions.
 *
 * The same guards and the same permissions as the REST controller, over the same services: a GraphQL
 * caller and a REST caller cannot diverge in what they may do or in what a rule means. The transitions
 * are mutations rather than a writable status field, because a status is the outcome of an event with a
 * precondition, not a value to patch.
 *
 * The retry declarations are the routes' own, under the same scope names, so a client that retries a
 * create presents one operation whichever protocol carried it. A GraphQL request may select several
 * mutations, so the key rides beside the input it qualifies — the `idempotencyKey` member of the
 * mutation's own input — which is the member the kernel reads it from.
 *
 * The label mutation carries two declarations rather than one, for the same reason its route does: the
 * key makes a re-fetch safe to repeat, and the version makes the write refuse a shipment that moved on
 * instead of overwriting it. A GraphQL operation travels over `POST` whichever root type it selects, so
 * the write is stated rather than inferred.
 */
@Resolver(() => Fulfillment)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
export class FulfillmentResolver {
	constructor(
		private readonly fulfillmentService: FulfillmentService,
		private readonly lineService: FulfillmentLineService
	) {}

	/**
	 * Lists fulfilments.
	 *
	 * @param filter The filter arguments.
	 * @returns A page of fulfilments.
	 * @throws BadRequestException when a status or a direction is given that a fulfilment does not have.
	 */
	@Query(() => Object, { name: 'fulfillments' })
	async fulfillments(
		@Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
		@Args('direction', { type: () => String, nullable: true }) direction?: string
	): Promise<IFulfillmentConnection> {
		const where: FindOptionsWhere<Fulfillment> = {};

		if (orderId) {
			where.orderId = orderId;
		}

		if (status) {
			if (!isFulfillmentStatusDetail(status)) {
				throw new BadRequestException(
					`The fulfilment status "${status}" is not one of: ${FULFILLMENT_STATUS_DETAILS.join(', ')}.`
				);
			}

			where.status = status;
		}

		if (warehouseId) {
			where.warehouseId = warehouseId;
		}

		if (direction) {
			if (!isFulfillmentDirection(direction)) {
				throw new BadRequestException(
					`The fulfilment direction "${direction}" is not one of: ${FULFILLMENT_DIRECTIONS.join(', ')}.`
				);
			}

			where.direction = direction;
		}

		const page = (await this.fulfillmentService.findAll({ where })) as IPagination<Fulfillment>;

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one fulfilment with its lines.
	 *
	 * @param id The fulfilment.
	 * @returns The fulfilment.
	 */
	@Query(() => Object, { name: 'fulfillment', nullable: true })
	async fulfillment(@Args('id', { type: () => ID }) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.findOneByIdString(id, { relations: ['lines'] });
	}

	/**
	 * What an order line still has to ship.
	 *
	 * @param orderLineId The order line.
	 * @returns The outstanding quantity.
	 */
	@Query(() => Object, { name: 'fulfillmentOutstanding' })
	async fulfillmentOutstanding(@Args('orderLineId', { type: () => ID }) orderLineId: string): Promise<number> {
		return this.fulfillmentService.outstandingOf(orderLineId);
	}

	/**
	 * Creates a fulfilment for an order, partially or in full.
	 *
	 * @param input The fulfilment and its lines.
	 * @returns The created fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_CREATE)
	@Idempotent({ scope: 'fulfillment.create', required: true, resourceType: 'fulfillment' })
	@Mutation(() => Object, { name: 'createFulfillment' })
	async createFulfillment(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Fulfillment> {
		return this.fulfillmentService.create(input as any);
	}

	/**
	 * Updates a fulfilment's tracking details or note.
	 *
	 * @param id The fulfilment.
	 * @param input The fields to change.
	 * @returns The fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'updateFulfillment' })
	async updateFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<Fulfillment> {
		await this.fulfillmentService.update(id, input as any);

		return this.fulfillmentService.findOneByIdString(id, { relations: ['lines'] });
	}

	/**
	 * Marks a fulfilment as handed to the carrier.
	 *
	 * @param id The fulfilment.
	 * @param input The tracking details.
	 * @returns The shipped fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'fulfillment.ship', required: false, resourceType: 'fulfillment' })
	@Mutation(() => Object, { name: 'shipFulfillment' })
	async shipFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object, nullable: true }) input?: Record<string, any>
	): Promise<Fulfillment> {
		return this.fulfillmentService.ship(id, input ?? {});
	}

	/**
	 * Records that the carrier reported movement.
	 *
	 * @param id The fulfilment.
	 * @returns The updated fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'markFulfillmentInTransit' })
	async markFulfillmentInTransit(@Args('id', { type: () => ID }) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.markInTransit(id);
	}

	/**
	 * Marks a fulfilment as delivered.
	 *
	 * @param id The fulfilment.
	 * @returns The delivered fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'deliverFulfillment' })
	async deliverFulfillment(@Args('id', { type: () => ID }) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.deliver(id);
	}

	/**
	 * Cancels a fulfilment that has not been delivered.
	 *
	 * @param id The fulfilment.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'cancelFulfillment' })
	async cancelFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String, nullable: true }) reason?: string
	): Promise<Fulfillment> {
		return this.fulfillmentService.cancel(id, reason);
	}

	/**
	 * Requests a carrier label for a shipment, or asks the carrier for the one it already issued.
	 *
	 * The mutation mirrors the route member for member: the same permission, the same retry scope and
	 * the same versioned declaration, over the same service method, so a client that retries on one
	 * protocol and succeeds on the other cannot diverge in what it is allowed to do or in what a rule
	 * means. The version travels beside the input it qualifies, because one GraphQL request may select
	 * several mutations and a header could say which of them a version belongs to.
	 *
	 * @param id The fulfilment.
	 * @param input The carrier strategy, the service level, and the key and version the caller states.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The fulfilment with its label recorded.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'fulfillment.label', required: false, resourceType: 'fulfillment' })
	@Versioned({ resource: FulfillmentService })
	@Mutation(() => Object, { name: 'requestFulfillmentLabel' })
	async requestFulfillmentLabel(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context?: any
	): Promise<Fulfillment> {
		return this.fulfillmentService.requestLabel(id, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Resolves a fulfilment's lines.
	 *
	 * @param fulfillment The parent fulfilment.
	 * @returns The lines.
	 */
	@ResolveField('lines', () => [Object], { nullable: true })
	async lines(@Parent() fulfillment: Fulfillment): Promise<FulfillmentLine[]> {
		const page = (await this.lineService.findAll({
			where: { fulfillmentId: fulfillment.id }
		})) as IPagination<FulfillmentLine>;

		return page.items;
	}
}
