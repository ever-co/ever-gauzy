import { Args, Context, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	resolveConnectionWindow,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { fulfillmentVersionOf } from '../fulfillment.types';
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
 * The shipment's inherited lifecycle pair and the line's live here too — `softDeleteFulfillment` and
 * `recoverFulfillment`, `softDeleteFulfillmentLine` and `recoverFulfillmentLine`. The line is the reason
 * the second pair is not in a resolver of its own: it has none, because it is read through the shipment
 * as the `lines` field below resolves it, so these two fields are the only root fields a line can be
 * withdrawn and restored through.
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
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver(() => Fulfillment)
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns A page of fulfilments.
	 * @throws BadRequestException when a status or a direction is given that a fulfilment does not have.
	 */
	@Query(() => Object, { name: 'fulfillments' })
	async fulfillments(
		@Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
		@Args('direction', { type: () => String, nullable: true }) direction?: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IFulfillmentConnection> {
		const where: FindOptionsWhere<Fulfillment> = {};
		const { skip, take } = resolveConnectionWindow(page);

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

		const listing = (await this.fulfillmentService.findAll({
			where,
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<Fulfillment>;

		return connectionFromOffsetPage(listing, skip);
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
	 * Corrects one shipment line.
	 *
	 * The route it mirrors is `PUT /fulfillment-lines/:id`, which the controller declares rather than
	 * inherits for the reason its own header states: a body is validated from the type the handler names,
	 * and the base class names the entity's shape as a generic whose reflected type is `Object`, so an
	 * inherited route accepts any body at all and writes it. The correction is the repair surface for a
	 * line recorded on its own — a line is normally written as part of its shipment, through
	 * `createFulfillment`'s own `lines`, which is why that field and not this one is how a line is created.
	 *
	 * **This is the only field that reaches the line service's `update`.** `softDeleteFulfillmentLine` and
	 * `recoverFulfillmentLine` reach `softRemove` and `softRecover`, which move the row's `deletedAt` and
	 * leave every column where it was; `createFulfillment` writes new rows. Until this field, a line that
	 * had been recorded could not be corrected over GraphQL at all, while a REST caller could correct it.
	 *
	 * **The `metadata` member, which no other field could write.** `FulfillmentLineInput` carries the order
	 * line, the quantity and the warehouse and nothing else, so the parent's own create could not state a
	 * payload either — the column was reachable in neither direction. The edit is the door
	 * `05-database-schema-specification.md` §13.5 declares the column behind, and the delivery already says
	 * what lives in it: "the picked bin, the short-pick note, the serial numbers".
	 *
	 * **The write is the route's, argument for argument** — `update(id, input)` on the same service, under
	 * the same `FULFILLMENTS_EDIT` grant. The read that follows is this field's own, because the route
	 * answers whatever the ORM's update returned and a root field has to answer the row; it is a *read*, so
	 * it cannot make the two surfaces behave differently, which is the axis §3.1 forbids.
	 *
	 * The retry declarations are the route's, which is to say there are none: the route declares no
	 * `@Idempotent` and no `@Versioned`, and `fulfillment_line` carries no version column for an
	 * expectation to be compared against.
	 *
	 * @param id The line to correct.
	 * @param input The fields to change.
	 * @returns The line as the write left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'updateFulfillmentLine' })
	async updateFulfillmentLine(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<FulfillmentLine> {
		await this.lineService.update(id, input as any);

		return this.lineService.findOneByIdString(id);
	}

	/**
	 * Marks a fulfilment as handed to the carrier.
	 *
	 * @param id The fulfilment.
	 * @param input The tracking details, and the version the caller read the shipment at when it states
	 * one.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The shipped fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'fulfillment.ship', required: false, resourceType: 'fulfillment' })
	@Versioned({ resource: FulfillmentService, required: false })
	@Mutation(() => Object, { name: 'shipFulfillment' })
	async shipFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object, nullable: true }) input?: Record<string, any>,
		@Context() context?: any
	): Promise<Fulfillment> {
		return this.fulfillmentService.ship(id, input ?? {}, fulfillmentVersionOf(context?.req));
	}

	/**
	 * Records that the carrier reported movement.
	 *
	 * @param id The fulfilment.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The updated fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Versioned({ resource: FulfillmentService, required: false })
	@Mutation(() => Object, { name: 'markFulfillmentInTransit' })
	async markFulfillmentInTransit(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<Fulfillment> {
		return this.fulfillmentService.markInTransit(id, fulfillmentVersionOf(context?.req));
	}

	/**
	 * Marks a fulfilment as delivered.
	 *
	 * @param id The fulfilment.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The delivered fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Versioned({ resource: FulfillmentService, required: false })
	@Mutation(() => Object, { name: 'deliverFulfillment' })
	async deliverFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<Fulfillment> {
		return this.fulfillmentService.deliver(id, undefined, fulfillmentVersionOf(context?.req));
	}

	/**
	 * Cancels a fulfilment that has not been delivered.
	 *
	 * @param id The fulfilment.
	 * @param reason Why it was cancelled.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The cancelled fulfilment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Versioned({ resource: FulfillmentService, required: false })
	@Mutation(() => Object, { name: 'cancelFulfillment' })
	async cancelFulfillment(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String, nullable: true }) reason?: string,
		@Context() context?: any
	): Promise<Fulfillment> {
		return this.fulfillmentService.cancel(id, reason, fulfillmentVersionOf(context?.req));
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
	 * Retires a shipment recoverably, keeping the lines that say what it carried.
	 *
	 * The route it mirrors is `DELETE /fulfillments/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Cancelling is a
	 * transition of the shipment's own lifecycle and records a cancellation on a shipment that is still
	 * read; withdrawing the row is a different act, so without this field a shipment a caller retired over
	 * GraphQL had no field to bring it back, while a REST caller could retire and restore it.
	 *
	 * The permission is the controller's own for the route — `FULFILLMENTS_EDIT` — and not the class-level
	 * view grant, because a retired shipment is what the order's materialised fulfilment status no longer
	 * counts.
	 *
	 * @param id The shipment to retire.
	 * @returns The shipment, as the soft delete left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteFulfillment' })
	async softDeleteFulfillment(@Args('id', { type: () => ID }) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.softRemove(id);
	}

	/**
	 * Restores a shipment that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /fulfillments/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored shipment
	 * counts towards what the order has shipped again, which is why the route states the editing grant
	 * rather than the reading one.
	 *
	 * @param id The shipment to restore.
	 * @returns The restored shipment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'recoverFulfillment' })
	async recoverFulfillment(@Args('id', { type: () => ID }) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.softRecover(id);
	}

	/**
	 * Removes a shipment outright, as `DELETE /fulfillments/:id` does.
	 *
	 * **This is the destructive route and not the recoverable one, and the delivery already states the
	 * difference.** `softDeleteFulfillment` above retires a shipment and `recoverFulfillment` brings it
	 * back; this field reaches `delete`, which is `CrudController`'s inherited handler delegating to
	 * `TenantAwareCrudService.delete` and the ORM's own removal, so the row leaves the table and nothing
	 * can bring it back. The sibling field's docstring draws the line the same way from the other side:
	 * "Cancelling is a transition of the shipment's own lifecycle and records a cancellation on a shipment
	 * that is still read; withdrawing the row is a different act, so without this field a shipment a caller
	 * retired over GraphQL had no field to bring it back, while a REST caller could retire and restore it."
	 * A caller that wants the withdrawal which can be undone states the other name.
	 *
	 * **Why a hard delete is mirrored in this domain at all.** §3.2's fulfillment row already declares
	 * `deleteShippingProfile` and `deleteShippingOption` — the hard deletes of two of this domain's own
	 * resources — so the destructive route is part of the set this domain mirrors rather than something
	 * §3.1's parity clause stops at, and `17-graphql-api-specification.md` §9.7 gives the shape its name:
	 * "`DELETE /<resource>/:id` | `delete<Type>(id: ID!)`". Leaving this one route unmirrored while its two
	 * siblings are fields would make the domain inconsistent with itself. The counter-reading is recorded
	 * rather than hidden, because an owner may want it settled: `16-decision-log-and-open-questions.md`
	 * ADR-24 says "nothing is hard-deleted by application code except by an explicit administrative purge",
	 * and a shipment is a row the order line's own counters were derived from, so the recoverable pair is
	 * the door most callers want and this field is the administrative one beside it.
	 *
	 * The retry declarations are the route's, which is to say there are none: the route declares no
	 * `@Idempotent` and no `@Versioned`, and a scope invented here would replay a GraphQL retry that the
	 * REST route lets through — a difference in behaviour rather than in transport.
	 *
	 * **What the boolean says, and what it does not.** The route answers the ORM's `DeleteResult`; this
	 * field answers a boolean, because that is what the two delete fields of this document already answer
	 * and a third shape would be a second vocabulary for one act. `Boolean(result)` is `true` whenever the
	 * delete statement ran without raising, **including when it matched no row at all** —
	 * `TenantAwareCrudService.delete` checks no existence, so an identifier that was never there answers
	 * `true` here where the route's own body would carry `affected: 0`. That divergence is recorded rather
	 * than settled: answering `result.affected > 0` would close it, and would have to be made on
	 * `deleteShippingProfile` and `deleteShippingOption` in the same change, or this domain would hold two
	 * conventions for one answer.
	 *
	 * @param id The shipment to remove.
	 * @returns True when the removal statement ran, which is not the same as a row having matched.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Boolean, { name: 'deleteFulfillment' })
	async deleteFulfillment(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.fulfillmentService.delete(id);

		return Boolean(result);
	}

	/**
	 * Retires a shipment line recoverably, keeping what the shipment covered.
	 *
	 * The route it mirrors is `DELETE /fulfillment-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. The hard delete the
	 * endpoint does serve drops the row the order line's own counters were derived from, which is exactly
	 * what the soft route exists to avoid — so a client that held only this resolver could not express the
	 * recoverable withdrawal at all.
	 *
	 * The permission is the controller's own for the route — `FULFILLMENTS_EDIT` — and not the class-level
	 * view grant, because retiring a line changes how much of an order line is recorded as shipped.
	 *
	 * @param id The line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteFulfillmentLine' })
	async softDeleteFulfillmentLine(@Args('id', { type: () => ID }) id: string): Promise<FulfillmentLine> {
		return this.lineService.softRemove(id);
	}

	/**
	 * Restores a shipment line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /fulfillment-lines/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored line is
	 * read through its shipment again, which is why the route states the editing grant rather than the
	 * reading one.
	 *
	 * @param id The line to restore.
	 * @returns The restored line.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Object, { name: 'recoverFulfillmentLine' })
	async recoverFulfillmentLine(@Args('id', { type: () => ID }) id: string): Promise<FulfillmentLine> {
		return this.lineService.softRecover(id);
	}

	/**
	 * Removes a shipment line outright, as `DELETE /fulfillment-lines/:id` does.
	 *
	 * **The recoverable withdrawal is the sibling field, and this is not it.** `softDeleteFulfillmentLine`
	 * above reaches `softRemove`, which sets `deletedAt` and is undone by `recoverFulfillmentLine`; this
	 * field reaches `delete`, the inherited handler's own service call, which removes the row. Both routes
	 * are declared by the same controller and this plugin now serves both on both protocols.
	 *
	 * **What the destructive one costs, in the delivery's own words.** The sibling field's docstring states
	 * it and states it better than a summary could: "The hard delete the endpoint does serve drops the row
	 * the order line's own counters were derived from, which is exactly what the soft route exists to
	 * avoid — so a client that held only this resolver could not express the recoverable withdrawal at
	 * all." That sentence is the reason `softDeleteFulfillmentLine` exists *beside* this field rather than
	 * instead of it, and it is repeated here because a caller reading only this name should meet it: the
	 * row being removed is the one `order_line.fulfilledQuantity` and its two siblings are summed from
	 * (`05-database-schema-specification.md` §11.2), so the recoverable pair is the withdrawal most callers
	 * want and this field is the administrative one.
	 *
	 * The retry declarations are the route's, which is to say there are none: the route declares no
	 * `@Idempotent` and no `@Versioned`, and `fulfillment_line` carries no version column for an
	 * expectation to be compared against.
	 *
	 * **What the boolean says, and what it does not.** The route answers the ORM's `DeleteResult`; this
	 * field answers a boolean, because that is what the two delete fields of this document already answer
	 * and a third shape would be a second vocabulary for one act. `Boolean(result)` is `true` whenever the
	 * delete statement ran without raising, **including when it matched no row at all** —
	 * `TenantAwareCrudService.delete` checks no existence, so an identifier that was never there answers
	 * `true` here where the route's own body would carry `affected: 0`. That divergence is recorded rather
	 * than settled: answering `result.affected > 0` would close it, and would have to be made on
	 * `deleteShippingProfile` and `deleteShippingOption` in the same change, or this domain would hold two
	 * conventions for one answer.
	 *
	 * @param id The line to remove.
	 * @returns True when the removal statement ran, which is not the same as a row having matched.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Mutation(() => Boolean, { name: 'deleteFulfillmentLine' })
	async deleteFulfillmentLine(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.lineService.delete(id);

		return Boolean(result);
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
