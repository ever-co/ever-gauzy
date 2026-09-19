import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, IReactionCreateInput, IReactionUpdateInput } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
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
import { Reaction } from './reaction.entity';
import { ReactionService } from './reaction.service';
import { ReactionCreateCommand, ReactionUpdateCommand } from './commands';

/** The members `CreateReactionInput` declares in the schema. */
export interface ICreateReactionInput {
	entity: string;
	entityId: Id;
	emoji: string;
	organizationId?: Id;
}

/** The members `UpdateReactionInput` declares in the schema. */
export interface IUpdateReactionInput {
	id: Id;
	emoji?: string;
	organizationId?: Id;
}

/**
 * The fields a reaction list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ReactionFilter` and `ReactionSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the reaction row, which is why the set is what it is: the delivered list
 * read answers the row itself and joins only the relations a REST caller names in its query string —
 * which this surface never names — so each member here narrows the rows the connection was handed
 * rather than a collection a reader would have had to load. The two relations the row owns are
 * deliberately absent from both lists, for the reason the object type states: neither the reacted-to
 * row nor the employee behind `employeeId` is loaded by the read behind this surface.
 *
 * `entity` and `actorType` are text members rather than enumerated ones, because both are carried as
 * the value their own vocabulary states: an enum here would be a second declaration of a value set
 * this domain does not own, and a filter is exactly where the two would silently drift apart.
 */
const REACTION_FILTERABLE = {
	id: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	emoji: 'STRING',
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
const REACTION_SORTABLE = ['id', 'entity', 'entityId', 'emoji', 'createdAt', 'updatedAt', 'deletedAt'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store the criterion its caller
 * carried and takes the rows as they come back — so this is the platform's own: newest first, with the
 * identifier as the last key so that two marks left in the same millisecond still have one order
 * between them, which is what makes a cursor walk over them total.
 */
const REACTION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The reaction over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ReactionService` method, or dispatches the same
 * command, that the `/api/reaction` routes reach — including the four whose routes the controller
 * inherits from the CRUD base rather than declaring.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` and `PermissionGuard` on the class and
 * states no `@Permissions` at all: not on the five routes it declares and not on the four it inherits.
 * `PermissionGuard` serves a request that states no permission — a route that requires none is
 * authorized — so the pair is a scope decision rather than a grant this resource asks for. The class
 * here therefore states the same two guards plus the gate, and no field states a permission; a field
 * that demanded one would refuse a caller the REST route serves, which is the asymmetry the
 * two-protocol rule forbids.
 *
 * **The edit answers the row, and the delivered command answers the store's result.** The handler
 * behind `PUT /:id` reads the row — narrowed to the caller's own employee, which is how somebody
 * else's reaction is answered with the refusal — and then persists the members a body states and
 * answers `{ affected }` on one ORM. A statement about a write is not a row, so the field dispatches
 * the same command and then reads the row back through the same service, which is the shape this
 * codebase's other update fields take for the same reason.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and why
 * it is appended to the guard chain the routes below already carry rather than replacing any part of
 * it.
 */
@Resolver('Reaction')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ReactionResolver {
	constructor(
		private readonly reactionService: ReactionService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The reactions of the caller's tenant, newest first.
	 */
	@Query('reactions')
	async reactions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Reaction>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`. The tenant is applied to the criterion by the service, from the
		// credential rather than from the caller.
		const { items }: IPagination<Reaction> = await this.reactionService.findAll({} as BaseQueryDTO<Reaction>);

		return buildConnection<Reaction>({
			rows: items ?? [],
			filterable: REACTION_FILTERABLE,
			sortable: REACTION_SORTABLE,
			defaultSort: REACTION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One reaction of the caller's tenant.
	 *
	 * The read is handed the empty options DTO the delivered route binds from a query string that
	 * states nothing, which is what keeps the two reads one call rather than two spellings of it.
	 *
	 * A reaction that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('reaction')
	async reaction(@Args('id', { type: () => ID }) id: Id): Promise<Reaction | null> {
		try {
			return await this.reactionService.findOneByIdString(id, {} as FindOptionsQueryDTO<Reaction>);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many reactions the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('reactionCount')
	async reactionCount(): Promise<number> {
		return await this.reactionService.countBy();
	}

	/**
	 * Leaves a reaction, through the command the delivered create route dispatches.
	 *
	 * The payload is the input as stated, and everything the caller does not state is the credential's
	 * or the handler's: the tenant is stamped, the acting employee is resolved from the request, and
	 * the actor type is set by the handler rather than taken from a body. The write is a toggle — a mark
	 * that is already there is withdrawn instead of filed a second time — which is the delivered
	 * command's behaviour and not a decision this field makes.
	 */
	@Mutation('createReaction')
	async createReaction(@Args('input') input: ICreateReactionInput): Promise<Reaction> {
		return await this.commandBus.execute(
			new ReactionCreateCommand(input as unknown as IReactionCreateInput)
		);
	}

	/**
	 * Changes a reaction that exists, through the command the delivered edit route dispatches.
	 *
	 * The identifier is the criterion and travels inside the command's payload, which is the shape the
	 * route itself has: `:id` names the row and the body carries what changes. The handler's read
	 * narrows the row to the caller's own employee before it writes, so a reaction that is not the
	 * caller's is answered with the refusal rather than with a write, and a member the caller leaves out
	 * is left as it is.
	 *
	 * The answer is the row the write produced, read back through the same service: the delivered
	 * command answers the store's own result — a statement about the write — and a field named
	 * `updateReaction` owes its caller the row the write left behind.
	 */
	@Mutation('updateReaction')
	async updateReaction(@Args('input') input: IUpdateReactionInput): Promise<Reaction> {
		await this.commandBus.execute(
			new ReactionUpdateCommand(input.id, input as unknown as IReactionUpdateInput)
		);

		return await this.reactionService.findOneByIdString(input.id, {} as FindOptionsQueryDTO<Reaction>);
	}

	/**
	 * Removes a reaction outright.
	 *
	 * The service is the one the REST route calls, and it narrows the removal to the caller's own
	 * employee and tenant from the credential rather than from an argument, which is why the field
	 * states no scope beside it. The field answers whether the removal happened rather than the removed
	 * row, because the delivered route answers the store's delete result.
	 */
	@Mutation('deleteReaction')
	async deleteReaction(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.reactionService.delete(id);

		return true;
	}

	/**
	 * Withdraws a reaction: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteReaction')
	async softDeleteReaction(@Args('id', { type: () => ID }) id: Id): Promise<Reaction> {
		return await this.reactionService.softRemove(id);
	}

	/**
	 * Puts a withdrawn reaction back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverReaction')
	async recoverReaction(@Args('id', { type: () => ID }) id: Id): Promise<Reaction> {
		return await this.reactionService.softRecover(id);
	}
}
