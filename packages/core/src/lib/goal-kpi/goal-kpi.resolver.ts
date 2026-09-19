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
import { GoalKPI } from './goal-kpi.entity';
import { GoalKpiService } from './goal-kpi.service';

/** The members `CreateGoalKPIInput` declares in the schema. */
export interface ICreateGoalKPIInput {
	name: string;
	description?: string;
	type: string;
	unit?: string;
	operator: string;
	currentValue: number;
	targetValue: number;
	leadId?: Id;
	organizationId?: Id;
}

/** The members `UpdateGoalKPIInput` declares in the schema. */
export interface IUpdateGoalKPIInput extends Partial<ICreateGoalKPIInput> {
	id: Id;
}

/**
 * The fields a measure list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `GoalKPIFilter` and `GoalKPISortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the KPI row, because that is what the connection protocol evaluates.
 * `leadId` is here and `lead` is not: the list read joins the relation, but the node read, the count
 * and the five writes do not, so the identifier is the member that always has a value.
 */
const GOAL_KPI_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	type: 'STRING',
	unit: 'STRING',
	operator: 'STRING',
	currentValue: 'NUMBER',
	targetValue: 'NUMBER',
	leadId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const GOAL_KPI_SORTABLE = ['createdAt', 'updatedAt', 'name', 'type', 'currentValue', 'targetValue'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two measures filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const GOAL_KPI_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The measure a key result tracks over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `GoalKpiService` method the `/api/goal-kpi` routes call.
 *
 * **The guard chain is the controller's, and no field states a permission.** `GoalKpiController`
 * carries `TenantPermissionGuard` on the class and nothing else: not a class-level permission and not
 * a handler-level one, on any of the four routes it declares or on any of the five it inherits. The
 * permission guard is not part of its chain, so it is not part of this one either. The spec reads the
 * controller's `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('GoalKPI')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class GoalKpiResolver {
	constructor(private readonly goalKpiService: GoalKpiService) {}

	/**
	 * The measures of the caller's tenant.
	 *
	 * The same read the list route performs: the route binds its query string to `findInput` and hands
	 * `findAll` the same criterion with the lead joined. The relation the route joins is stated here as
	 * well, so the rows this surface answers are the rows that route answers rather than a narrower
	 * projection of them.
	 */
	@Query('goalKpis')
	async goalKpis(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<GoalKPI>> {
		const { items }: IPagination<GoalKPI> = await this.goalKpiService.findAll({
			where: {},
			relations: ['lead']
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One measure of the caller's tenant.
	 *
	 * The read the inherited `GET /goal-kpi/:id` route performs. A measure that is not there answers
	 * `null` rather than a refusal: GraphQL has one answer for "no such row" on a field that may have
	 * none, and the REST route's `404` is that same fact stated in the other protocol's vocabulary.
	 */
	@Query('goalKpi')
	async goalKpi(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPI | null> {
		try {
			return await this.goalKpiService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many measures the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('goalKpiCount')
	async goalKpiCount(): Promise<number> {
		return await this.goalKpiService.countBy();
	}

	/**
	 * Files a measure.
	 *
	 * The same service method the create route calls, with the row's own shape — that route declares no
	 * validation pipe, so what it accepts is the entity the store is handed.
	 */
	@Mutation('createGoalKpi')
	async createGoalKpi(@Args('input') input: ICreateGoalKPIInput): Promise<GoalKPI> {
		return await this.goalKpiService.create(input as never);
	}

	/**
	 * Changes a measure.
	 *
	 * The delivered route is an update-through-create and this field is the same call with the stated
	 * identifier spread over the body. The delivered route wraps any failure in a bad request; that
	 * wrapper is a statement about the HTTP status this surface does not have, so the service's own
	 * refusal — which is a bad request already — travels instead.
	 */
	@Mutation('updateGoalKpi')
	async updateGoalKpi(@Args('input') input: IUpdateGoalKPIInput): Promise<GoalKPI> {
		const { id, ...values } = input;

		return await this.goalKpiService.create({ ...values, id } as never);
	}

	/**
	 * Removes a measure outright.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@Mutation('deleteGoalKpi')
	async deleteGoalKpi(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.goalKpiService.delete(id);

		return true;
	}

	/**
	 * Withdraws a measure without removing it.
	 *
	 * The inherited `DELETE /goal-kpi/:id/soft` route's own call. The answer is the withdrawn row.
	 */
	@Mutation('softDeleteGoalKpi')
	async softDeleteGoalKpi(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPI> {
		return await this.goalKpiService.softRemove(id);
	}

	/**
	 * Puts a withdrawn measure back.
	 */
	@Mutation('recoverGoalKpi')
	async recoverGoalKpi(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPI> {
		return await this.goalKpiService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(rows: readonly GoalKPI[] | undefined, request: ConnectionRequest): GraphqlConnection<GoalKPI> {
		return buildConnection<GoalKPI>({
			rows: rows ?? [],
			filterable: GOAL_KPI_FILTERABLE,
			sortable: GOAL_KPI_SORTABLE,
			defaultSort: GOAL_KPI_DEFAULT_SORT,
			request
		});
	}
}
