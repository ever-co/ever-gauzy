import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	BaseEntityEnum,
	ID as Id,
	IPagination,
	ISharedEntityCreateInput,
	ISharedEntityUpdateInput,
	JsonData
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { SharedEntity } from './shared-entity.entity';
import { SharedEntityService } from './shared-entity.service';
import { SharedEntityCreateCommand, SharedEntityUpdateCommand } from './commands';

/** The members `CreateSharedEntityInput` declares in the schema. */
export interface ICreateSharedEntityInput {
	organizationId: Id;
	entity: BaseEntityEnum | string;
	entityId: Id;
	shareRules: unknown;
	sharedOptions?: JsonData;
}

/** The members `UpdateSharedEntityInput` declares in the schema. */
export interface IUpdateSharedEntityInput {
	id: Id;
	organizationId: Id;
	shareRules: unknown;
	sharedOptions?: JsonData;
}

/**
 * The fields a share list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `SharedEntityFilter` and
 * `SharedEntitySortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The pair the target is addressed by is `STRING` and `ID` respectively, because the entity names a
 * table and the record identifier addresses a row inside it. Both are filterable, and together they
 * are the question a client asks when it wants the shares over one record.
 */
const SHARED_ENTITY_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	token: 'STRING',
	entity: 'STRING',
	entityId: 'ID',
	shareRules: 'JSON',
	sharedOptions: 'JSON',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const SHARED_ENTITY_SORTABLE = ['createdAt', 'updatedAt', 'entity'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: newest first, because shares are issued and audited in that
 * order, then the identifier, which is the key that makes the order total and a cursor walk over it
 * stable.
 */
const SHARED_ENTITY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The shared entity over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `SharedEntityService` method, or dispatches the same
 * command, that the `/api/shared-entities` routes reach.
 *
 * **The guard chain is the controller's: one guard and no permission.** The controller carries
 * `TenantPermissionGuard` on the class and states no `@Permissions` anywhere, so this class carries
 * that guard and the gate below and nothing else — no permission on the class and none on a field.
 *
 * **The token read is a root field of its own, and it answers the share's target rather than the
 * share.** The delivered method resolves the token, resolves the record the share names, applies the
 * share's stored rules to select the members a reader may see and to bound how far the reader may
 * walk its relations, and answers that document. Its shape is decided per share at read time, which
 * is why the field is typed as `JSON` rather than as a type this schema could declare — and why it
 * cannot be a filter over the connection, whose rows are `SharedEntity` rows.
 *
 * **That field is not marked `@Public()`, although its route is, and the reason is the gate over this
 * surface.** The marker is read by the global authentication guard, which returns before it
 * authenticates the caller; a marked field would run with no user on the request, so the capability
 * gate would resolve from a context carrying no tenant and refuse the field to every caller. That is
 * the failure this platform already observed when its two reference-data resolvers were gated. The
 * field is therefore served to a caller who presents a credential and is narrower than the open
 * route: a share recipient holding only a token reaches the route, not this field. Stating the
 * narrowing is preferable to shipping a field that answers `Cannot query field sharedEntityByToken`
 * to everybody.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('SharedEntity')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class SharedEntityResolver {
	constructor(
		private readonly sharedEntityService: SharedEntityService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The shares of the caller's tenant, newest first.
	 */
	@Query('sharedEntities')
	async sharedEntities(
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
	): Promise<GraphqlConnection<SharedEntity>> {
		// The delivered list route hands the service the query DTO it bound. This surface has no query
		// string to bind, so the read runs with the route's own defaults — no criterion, no relations, no
		// page — and the connection protocol's `filter` narrows the rows the service returns. The tenant
		// is applied to the criterion by the service, from the credential rather than from the caller.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<SharedEntity>;
		const { items }: IPagination<SharedEntity> = await this.sharedEntityService.findAll(options);

		return buildConnection<SharedEntity>({
			rows: items ?? [],
			filterable: SHARED_ENTITY_FILTERABLE,
			sortable: SHARED_ENTITY_SORTABLE,
			defaultSort: SHARED_ENTITY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One share of the caller's tenant.
	 */
	@Query('sharedEntity')
	async sharedEntity(@Args('id', { type: () => ID }) id: Id): Promise<SharedEntity | null> {
		try {
			return await this.sharedEntityService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many shares the caller's tenant holds.
	 */
	@Query('sharedEntityCount')
	async sharedEntityCount(): Promise<number> {
		return await this.sharedEntityService.countBy();
	}

	/**
	 * The record one share's token points at, with the share's rules applied.
	 *
	 * The same service method the delivered route calls, with the same single argument. A token that is
	 * not there, one whose share has been withdrawn and one whose target has gone are one answer on
	 * purpose — the delivered method catches every failure and raises the same miss — so this field
	 * lets that refusal through rather than turning it into a null, because telling the three apart
	 * would confirm which tokens are live.
	 */
	@Query('sharedEntityByToken')
	async sharedEntityByToken(@Args('token', { type: () => String }) token: string): Promise<unknown> {
		return await this.sharedEntityService.getSharedEntityByToken(token);
	}

	/**
	 * Creates a share through the same command the REST route dispatches.
	 *
	 * The delivered service refuses a target that is not the caller's own before it writes anything, so
	 * a share cannot be minted over another tenant's record; the field lets that refusal through.
	 */
	@Mutation('createSharedEntity')
	async createSharedEntity(@Args('input') input: ICreateSharedEntityInput): Promise<SharedEntity> {
		return await this.commandBus.execute(
			new SharedEntityCreateCommand(input as unknown as ISharedEntityCreateInput)
		);
	}

	/**
	 * Changes a share's rules through the same command the REST route dispatches.
	 *
	 * The delivered service strips the identifier, the target and the token from whatever body it is
	 * given before it writes, so the pinning the input states is the writer's own behaviour rather
	 * than a promise this surface makes on its behalf.
	 */
	@Mutation('updateSharedEntity')
	async updateSharedEntity(@Args('input') input: IUpdateSharedEntityInput): Promise<SharedEntity> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new SharedEntityUpdateCommand(id, values as unknown as ISharedEntityUpdateInput)
		);
	}

	/**
	 * Removes a share outright: its token stops resolving and there is nothing to restore.
	 */
	@Mutation('deleteSharedEntity')
	async deleteSharedEntity(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.sharedEntityService.delete(id);

		return true;
	}

	/**
	 * Withdraws a share: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteSharedEntity')
	async softDeleteSharedEntity(@Args('id', { type: () => ID }) id: Id): Promise<SharedEntity> {
		return await this.sharedEntityService.softRemove(id);
	}

	/**
	 * Puts a withdrawn share back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverSharedEntity')
	async recoverSharedEntity(@Args('id', { type: () => ID }) id: Id): Promise<SharedEntity> {
		return await this.sharedEntityService.softRecover(id);
	}
}
