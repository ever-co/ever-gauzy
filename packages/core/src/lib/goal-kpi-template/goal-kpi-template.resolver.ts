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
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { GoalKpiTemplateService } from './goal-kpi-template.service';

/** The members `CreateGoalKPITemplateInput` declares in the schema. */
export interface ICreateGoalKPITemplateInput {
	name: string;
	description?: string;
	type: string;
	unit?: string;
	operator: string;
	currentValue?: number;
	targetValue?: number;
	organizationId?: Id;
}

/** The members `UpdateGoalKPITemplateInput` declares in the schema. */
export interface IUpdateGoalKPITemplateInput extends Partial<ICreateGoalKPITemplateInput> {
	id: Id;
}

/**
 * The fields a catalogue list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `GoalKPITemplateFilter` and
 * `GoalKPITemplateSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 */
const GOAL_KPI_TEMPLATE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	type: 'STRING',
	unit: 'STRING',
	operator: 'STRING',
	currentValue: 'NUMBER',
	targetValue: 'NUMBER',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const GOAL_KPI_TEMPLATE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'type',
	'currentValue',
	'targetValue'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two entries filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const GOAL_KPI_TEMPLATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The catalogue a measure is authored from, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `GoalKpiTemplateService` method the
 * `/api/goal-kpi-template` routes call.
 *
 * **Two routes are declared and seven inherited, and the resolver mirrors all nine.** The controller
 * declares the list and the filing; the node, the count, the paginated spelling, the edit, the removal
 * and the two lifecycle moves come from the CRUD base. The two writes it does not declare are the
 * base's, and the base's edit answers the store's update result rather than a row, which is why the
 * edit field here writes and then reads the row back through the same reader the node query uses.
 *
 * **The guard chain is the controller's, and no field states a permission.** `GoalKpiTemplateController`
 * carries `TenantPermissionGuard` on the class and nothing else, on any of the nine routes, so the
 * permission guard is not part of this resolver's chain either. The spec reads the controller's
 * `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('GoalKPITemplate')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class GoalKpiTemplateResolver {
	constructor(private readonly goalKpiTemplateService: GoalKpiTemplateService) {}

	/**
	 * The catalogue entries of the caller's tenant.
	 *
	 * The same read the list route performs: the route binds its query string to `findInput` and
	 * `relations` and hands both to `findAll`. This surface has no query string to bind — the
	 * connection protocol states the caller's narrowing in `filter`, which the evaluator applies to the
	 * rows the service returns — so the read runs with the route's own defaults for an unstated
	 * request.
	 */
	@Query('goalKpiTemplates')
	async goalKpiTemplates(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<GoalKPITemplate>> {
		const { items }: IPagination<GoalKPITemplate> = await this.goalKpiTemplateService.findAll({
			where: {}
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One catalogue entry of the caller's tenant.
	 *
	 * The read the inherited `GET /goal-kpi-template/:id` route performs. An entry that is not there
	 * answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field that
	 * may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('goalKpiTemplate')
	async goalKpiTemplate(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPITemplate | null> {
		return await this.oneOrNone(id);
	}

	/**
	 * How many catalogue entries the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('goalKpiTemplateCount')
	async goalKpiTemplateCount(): Promise<number> {
		return await this.goalKpiTemplateService.countBy();
	}

	/**
	 * Files a catalogue entry.
	 *
	 * The same service method the create route calls, with the row's own shape — that route declares no
	 * validation pipe, so what it accepts is the entity the store is handed.
	 */
	@Mutation('createGoalKpiTemplate')
	async createGoalKpiTemplate(@Args('input') input: ICreateGoalKPITemplateInput): Promise<GoalKPITemplate> {
		return await this.goalKpiTemplateService.create(input as never);
	}

	/**
	 * Changes a catalogue entry.
	 *
	 * The delivered route is the CRUD base's own: it reads the row first — which is what turns an entry
	 * of another tenant, or one that is not there, into a miss — and then performs a partial column
	 * update whose answer is the store's update result. A field that promises a row cannot answer a
	 * statement about a write, so the row is read back through the same reader the node query uses.
	 */
	@Mutation('updateGoalKpiTemplate')
	async updateGoalKpiTemplate(@Args('input') input: IUpdateGoalKPITemplateInput): Promise<GoalKPITemplate> {
		const { id, ...values } = input;

		await this.goalKpiTemplateService.update(id, values as never);

		return (await this.goalKpiTemplateService.findOneByIdString(id)) as GoalKPITemplate;
	}

	/**
	 * Removes a catalogue entry outright.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@Mutation('deleteGoalKpiTemplate')
	async deleteGoalKpiTemplate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.goalKpiTemplateService.delete(id);

		return true;
	}

	/**
	 * Withdraws a catalogue entry without removing it.
	 *
	 * The inherited `DELETE /goal-kpi-template/:id/soft` route's own call.
	 */
	@Mutation('softDeleteGoalKpiTemplate')
	async softDeleteGoalKpiTemplate(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPITemplate> {
		return (await this.goalKpiTemplateService.softRemove(id)) as GoalKPITemplate;
	}

	/**
	 * Puts a withdrawn catalogue entry back.
	 */
	@Mutation('recoverGoalKpiTemplate')
	async recoverGoalKpiTemplate(@Args('id', { type: () => ID }) id: Id): Promise<GoalKPITemplate> {
		return (await this.goalKpiTemplateService.softRecover(id)) as GoalKPITemplate;
	}

	/**
	 * One catalogue entry, or null when there is none.
	 *
	 * A row that is not there is a miss, not a refusal, and the two are different facts: the delivered
	 * reader answers the first with a `404` and the surface answers it with `null`.
	 */
	private async oneOrNone(id: Id): Promise<GoalKPITemplate | null> {
		try {
			return (await this.goalKpiTemplateService.findOneByIdString(id)) as GoalKPITemplate;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly GoalKPITemplate[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<GoalKPITemplate> {
		return buildConnection<GoalKPITemplate>({
			rows: rows ?? [],
			filterable: GOAL_KPI_TEMPLATE_FILTERABLE,
			sortable: GOAL_KPI_TEMPLATE_SORTABLE,
			defaultSort: GOAL_KPI_TEMPLATE_DEFAULT_SORT,
			request
		});
	}
}
