import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard, Idempotent } from '@gauzy/core';
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
