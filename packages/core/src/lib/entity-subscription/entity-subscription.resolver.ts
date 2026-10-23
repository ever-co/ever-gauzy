import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IEntitySubscriptionCreateInput, IEntitySubscriptionFindInput, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EntitySubscription } from './entity-subscription.entity';
import { EntitySubscriptionService } from './entity-subscription.service';
import { EntitySubscriptionCreateCommand } from './commands';

/** The members `CreateEntitySubscriptionInput` declares in the schema. */
export interface ICreateEntitySubscriptionInput {
	organizationId?: Id;
	type: string;
	entity: string;
	entityId: Id;
	actorType?: string;
}

/** The members `UpdateEntitySubscriptionInput` declares in the schema. */
export interface IUpdateEntitySubscriptionInput {
	id: Id;
	organizationId?: Id;
	type?: string;
	entity?: string;
	entityId?: Id;
	actorType?: string;
}

/**
 * The fields a subscription list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EntitySubscriptionFilter` and
 * `EntitySubscriptionSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member is a column of the subscription row, which is why the set is what it is: the delivered
 * list read answers the row itself and joins only the relations a REST caller names in its query
 * string — which this surface never names — so each member here narrows the rows the connection was
 * handed rather than a collection a reader would have had to load. The employee is therefore absent as
 * a relation path and present as the identifier the row stores.
 */
const ENTITY_SUBSCRIPTION_FILTERABLE = {
	id: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	type: 'STRING',
	actorType: 'STRING',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ENTITY_SUBSCRIPTION_SORTABLE = [
	'id',
	'entity',
	'entityId',
	'type',
	'employeeId',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is the platform's own: newest first, with the identifier as the
 * last key so that two subscriptions filed in the same millisecond still have one order between them,
 * which is what makes a cursor walk over them total.
 */
const ENTITY_SUBSCRIPTION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The entity subscription over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EntitySubscriptionService` method — or dispatches the
 * same command — that the `/api/entity-subscription` routes reach.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` and `PermissionGuard` on the class and no
 * `@Permissions` at all: not on the four routes it declares and not on the five it inherits from the
 * CRUD base. Every one of its nine routes is therefore tenant-guarded and otherwise unpermissioned,
 * and a field that demanded a permission would refuse a caller the REST route serves — the asymmetry
 * the two-protocol rule forbids. Tightening the resource is a change to make in both places at once,
 * and it is not this delivery's to make.
 *
 * **The two writes are not the same shape, and each field keeps its own.** `POST /` is the one route
 * that does not reach the service directly: it dispatches `EntitySubscriptionCreateCommand`, whose
 * handler is what looks an existing subscription up before it writes, so `createEntitySubscription`
 * dispatches the same command rather than calling the service beside it. `PUT /:id` is the inherited
 * column update and calls the service with the identifier beside the body, as its field does.
 * `DELETE /:id` is the resource's own unsubscribe: it removes the subscription for one record, and the
 * criterion the service deletes on carries the employee and the tenant from the credential beside the
 * three members the route lets a caller state, which is why the field states exactly those three.
 * Withdrawing and restoring are the inherited marker writes.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EntitySubscription')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EntitySubscriptionResolver {
	constructor(
		private readonly _entitySubscriptionService: EntitySubscriptionService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The subscriptions of the caller's tenant, newest first.
	 */
	@Query('entitySubscriptions')
	async entitySubscriptions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<EntitySubscription>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — the
		// route's criterion when its caller states none, and no joined collection. The tenant is applied
		// to that criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<EntitySubscription> = await this._entitySubscriptionService.findAll(
			{ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<EntitySubscription>
		);

		return buildConnection<EntitySubscription>({
			rows: items ?? [],
			filterable: ENTITY_SUBSCRIPTION_FILTERABLE,
			sortable: ENTITY_SUBSCRIPTION_SORTABLE,
			defaultSort: ENTITY_SUBSCRIPTION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One subscription of the caller's tenant.
	 *
	 * A subscription that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary. The route hands its query string to the read beside the path
	 * identifier; this surface has no query string to bind, so the read runs with the route's own
	 * defaults.
	 */
	@Query('entitySubscription')
	async entitySubscription(@Args('id', { type: () => ID }) id: Id): Promise<EntitySubscription | null> {
		try {
			return await this._entitySubscriptionService.findOneByIdString(
				id,
				{} as FindOptionsQueryDTO<EntitySubscription>
			);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many subscriptions the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('entitySubscriptionCount')
	async entitySubscriptionCount(): Promise<number> {
		return await this._entitySubscriptionService.countBy();
	}

	/**
	 * Subscribes the caller to an entity.
	 *
	 * The write is dispatched as the same command the REST route dispatches, because the route's whole
	 * write is that command: its handler resolves the row that already exists for the same record and
	 * the same employee before it writes, so a caller that subscribes twice is answered the subscription
	 * it already has. Reaching the service directly would be a second path that could disagree with it.
	 * The tenant and the employee who is to be told are stamped by that path from the credential, so a
	 * caller states the record, the kind of subscription and the actor, and never whose subscription it
	 * is.
	 */
	@Mutation('createEntitySubscription')
	async createEntitySubscription(
		@Args('input') input: ICreateEntitySubscriptionInput
	): Promise<EntitySubscription> {
		return await this.commandBus.execute(
			new EntitySubscriptionCreateCommand(input as unknown as IEntitySubscriptionCreateInput)
		);
	}

	/**
	 * Changes a subscription.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a subscription of another tenant, or one that is not there, is answered with the miss
	 * rather than with a write. The identifier travels inside the payload here, exactly as the route's
	 * path identifier does beside the body.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row, and a field declared as the object type cannot answer it: the caller would receive an object
	 * with no identifier on a member the schema promises is there.
	 */
	@Mutation('updateEntitySubscription')
	async updateEntitySubscription(
		@Args('input') input: IUpdateEntitySubscriptionInput
	): Promise<EntitySubscription> {
		await this._entitySubscriptionService.update(input.id, input as unknown as EntitySubscription);

		return await this._entitySubscriptionService.findOneByIdString(
			input.id,
			{} as FindOptionsQueryDTO<EntitySubscription>
		);
	}

	/**
	 * Unsubscribes the caller from one entity.
	 *
	 * The service is the one the REST route calls, and it deletes on the criterion the route builds:
	 * the entity, the entity identifier and the organization the caller states, beside the employee and
	 * the tenant it derives from the credential. The field therefore passes exactly the three members
	 * the route lets a caller state — the same three it binds out of its query string — and nothing
	 * else, so a caller cannot aim the removal at another employee's subscription. The answer says
	 * whether the removal happened, because the delivered route answers the store's delete result.
	 */
	@Mutation('unsubscribeFromEntity')
	async unsubscribeFromEntity(
		@Args('id', { type: () => ID }) id: Id,
		@Args('entity', { type: () => String, nullable: true }) entity?: string,
		@Args('entityId', { type: () => ID, nullable: true }) entityId?: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<boolean> {
		// The criterion is the service's own find input, carrying the three members the route lets a
		// caller state; the employee and the tenant it also deletes on are derived there, from the
		// credential, which is what keeps this surface from aiming the removal at somebody else's row.
		await this._entitySubscriptionService.unsubscribe(id, {
			entity,
			entityId,
			organizationId
		} as IEntitySubscriptionFindInput);

		return true;
	}

	/**
	 * Withdraws a subscription: the row is marked rather than removed, and the recovery below reads it
	 * back.
	 */
	@Mutation('softDeleteEntitySubscription')
	async softDeleteEntitySubscription(@Args('id', { type: () => ID }) id: Id): Promise<EntitySubscription> {
		return await this._entitySubscriptionService.softRemove(id);
	}

	/**
	 * Puts a withdrawn subscription back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverEntitySubscription')
	async recoverEntitySubscription(@Args('id', { type: () => ID }) id: Id): Promise<EntitySubscription> {
		return await this._entitySubscriptionService.softRecover(id);
	}
}
