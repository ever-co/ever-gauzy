import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Goal } from './goal.entity';
import { GoalService } from './goal.service';

/** The members `CreateGoalInput` declares in the schema. */
export interface ICreateGoalInput {
	name: string;
	description?: string;
	deadline?: string;
	level?: string;
	progress?: number;
	ownerTeamId?: Id;
	ownerEmployeeId?: Id;
	leadId?: Id;
	alignedKeyResultId?: Id;
	organizationStrategicInitiativeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateGoalInput` declares in the schema. */
export interface IUpdateGoalInput extends Partial<ICreateGoalInput> {
	id: Id;
}

/**
 * The fields an objective list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `GoalFilter` and `GoalSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the schema
 * but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the goal row, because that is what the connection protocol evaluates.
 * The four relations the type carries as identifiers are here; the key results under an objective are
 * not, because they are the sibling aggregate's rows — a key result names its objective by `goalId`
 * and is read from its own surface with that identifier in `filter`.
 */
const GOAL_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	deadline: 'STRING',
	level: 'STRING',
	progress: 'NUMBER',
	ownerTeamId: 'ID',
	ownerEmployeeId: 'ID',
	leadId: 'ID',
	alignedKeyResultId: 'ID',
	organizationStrategicInitiativeId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const GOAL_SORTABLE = ['createdAt', 'updatedAt', 'name', 'level', 'progress'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * **This one is reproduced rather than chosen.** Every other reader in this tree hands the store a
 * criterion and takes the rows as they come back, so the connection has to decide an order; the
 * delivered goal list read is the exception — it states `order: { createdAt: 'ASC' }` of its own — and
 * a surface whose default differed from the route's would answer the same question in two orders. The
 * identifier is appended as the last key for the reason it always is: two objectives filed in the same
 * millisecond still need one order between them for a cursor walk to be stable, and the identifier is
 * the only column that always has one.
 */
const GOAL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The objective over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `GoalService` method the `/api/goals` routes call, and
 * nothing here rebuilds a criterion the delivered reader already builds.
 *
 * **The guard chain is the controller's, and no field states a permission.** `GoalController` carries
 * `TenantPermissionGuard` on the class and nothing else: not a class-level permission and not a
 * handler-level one, on any of the four routes it declares or on any of the five it inherits from the
 * CRUD base. The permission guard is not part of its chain at all, so it is not part of this one
 * either — a field that demanded a permission here would refuse a caller every one of those nine
 * routes serves. The spec reads the controller's own `__guards__` and `PERMISSIONS_METADATA` and
 * compares them with this class's rather than restating a list that could agree with the resolver
 * while disagreeing with the controller.
 *
 * **The list is the connection and the connection reproduces the route's order**, which is the one
 * place in this tree where the order is the route's rather than the surface's; the node read and the
 * count are the two inherited routes that are not the list, and each is a field of its own.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('Goal')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class GoalResolver {
	constructor(private readonly goalService: GoalService) {}

	/**
	 * The objectives of the caller's tenant, in the order the delivered route reads them.
	 *
	 * The same read the list route performs: the route binds its query string to `findInput` and
	 * `relations` and hands both to `findAll` with its own order. This surface has no query string to
	 * bind — the connection protocol states the caller's narrowing in `filter`, which the evaluator
	 * applies to the rows the service returns — so the read runs with the route's own defaults for an
	 * unstated request: no criterion beyond the tenant and the organization the base service merges in,
	 * no relation loaded, and the route's stated order. The controller serves the same rows a second
	 * time through the inherited `GET /pagination`; that is one capability, so it is this one field,
	 * and the connection's own `limit`/`offset` already are the page the paginated spelling performs.
	 */
	@Query('goals')
	async goals(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Goal>> {
		const { items }: IPagination<Goal> = await this.goalService.findAll({
			where: {},
			order: { createdAt: 'ASC' }
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One objective of the caller's tenant.
	 *
	 * The read the inherited `GET /goals/:id` route performs. An objective that is not there answers
	 * `null` rather than a refusal: GraphQL has one answer for "no such row" on a field that may have
	 * none, and the REST route's `404` is that same fact stated in the other protocol's vocabulary.
	 */
	@Query('goal')
	async goal(@Args('id', { type: () => ID }) id: Id): Promise<Goal | null> {
		try {
			return await this.goalService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many objectives the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('goalCount')
	async goalCount(): Promise<number> {
		return await this.goalService.countBy();
	}

	/**
	 * Files an objective.
	 *
	 * The same service method the create route calls, with the body that route validates. The tenant is
	 * stamped onto the row by the service from the credential and is therefore never an argument.
	 */
	@Mutation('createGoal')
	async createGoal(@Args('input') input: ICreateGoalInput): Promise<Goal> {
		return await this.goalService.create(input as never);
	}

	/**
	 * Edits an objective that exists.
	 *
	 * The delivered route is an update-through-create, and this field is the same two calls in the same
	 * order. The row is read first, so an objective of another tenant — or one that is not there — is a
	 * clean miss rather than a write that would recreate the row under an identifier the caller does
	 * not own; the service's own `create` refuses a cross-tenant row as well. The stated members are
	 * then merged onto the row, so a member the caller leaves out is left as it is.
	 */
	@Mutation('updateGoal')
	async updateGoal(@Args('input') input: IUpdateGoalInput): Promise<Goal> {
		const { id, ...values } = input;

		await this.goalService.findOneByIdString(id);

		return await this.goalService.create({ ...values, id } as never);
	}

	/**
	 * Removes an objective outright.
	 *
	 * The same service method the removal route calls. The route answers the store's delete result — a
	 * statement about the write rather than a row — so this field answers whether the removal ran,
	 * which is the most that answer carries.
	 */
	@Mutation('deleteGoal')
	async deleteGoal(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.goalService.delete(id);

		return true;
	}

	/**
	 * Withdraws an objective without removing it.
	 *
	 * The inherited `DELETE /goals/:id/soft` route's own call. The answer is the withdrawn row, whose
	 * `deletedAt` is the whole of what the write changed.
	 */
	@Mutation('softDeleteGoal')
	async softDeleteGoal(@Args('id', { type: () => ID }) id: Id): Promise<Goal> {
		return await this.goalService.softRemove(id);
	}

	/**
	 * Puts a withdrawn objective back.
	 */
	@Mutation('recoverGoal')
	async recoverGoal(@Args('id', { type: () => ID }) id: Id): Promise<Goal> {
		return await this.goalService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(rows: readonly Goal[] | undefined, request: ConnectionRequest): GraphqlConnection<Goal> {
		return buildConnection<Goal>({
			rows: rows ?? [],
			filterable: GOAL_FILTERABLE,
			sortable: GOAL_SORTABLE,
			defaultSort: GOAL_DEFAULT_SORT,
			request
		});
	}
}
