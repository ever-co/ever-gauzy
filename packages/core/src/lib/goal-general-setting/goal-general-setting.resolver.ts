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
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';

/** The members `CreateGoalGeneralSettingInput` declares in the schema. */
export interface ICreateGoalGeneralSettingInput {
	maxObjectives: number;
	maxKeyResults?: number;
	employeeCanCreateObjective?: boolean;
	canOwnObjectives?: string;
	canOwnKeyResult?: string;
	krTypeKPI?: boolean;
	krTypeTask?: boolean;
	organizationId?: Id;
}

/** The members `UpdateGoalGeneralSettingInput` declares in the schema. */
export interface IUpdateGoalGeneralSettingInput extends Partial<ICreateGoalGeneralSettingInput> {
	id: Id;
}

/**
 * The fields a policy list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `GoalGeneralSettingFilter` and
 * `GoalGeneralSettingSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `organizationId` is the member a caller actually narrows by here: a policy is the organization's
 * own, and a tenant with several organizations reads the one it is acting in by filtering on it.
 */
const GOAL_GENERAL_SETTING_FILTERABLE = {
	id: 'ID',
	maxObjectives: 'NUMBER',
	maxKeyResults: 'NUMBER',
	employeeCanCreateObjective: 'BOOLEAN',
	canOwnObjectives: 'STRING',
	canOwnKeyResult: 'STRING',
	krTypeKPI: 'BOOLEAN',
	krTypeTask: 'BOOLEAN',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const GOAL_GENERAL_SETTING_SORTABLE = ['createdAt', 'updatedAt', 'maxObjectives', 'maxKeyResults'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two policies filed in the
 * same millisecond still have one order between them, which is what makes a cursor walk over them
 * stable.
 */
const GOAL_GENERAL_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization's policy for the programme, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `GoalGeneralSettingService` method the
 * `/api/goal-general-setting` routes call.
 *
 * **The guard chain is the controller's, and no field states a permission.**
 * `GoalGeneralSettingController` carries `TenantPermissionGuard` on the class and nothing else, on any
 * of the nine routes, so the permission guard is not part of this resolver's chain either. The spec
 * reads the controller's `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('GoalGeneralSetting')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class GoalGeneralSettingResolver {
	constructor(private readonly goalGeneralSettingService: GoalGeneralSettingService) {}

	/**
	 * The policies of the caller's tenant.
	 *
	 * The same read the list route performs: the route binds its query string to `findInput` and hands
	 * it to `findAll`. This surface has no query string to bind — the connection protocol states the
	 * caller's narrowing in `filter`, which the evaluator applies to the rows the service returns — so
	 * the read runs with the route's own default for an unstated request.
	 */
	@Query('goalGeneralSettings')
	async goalGeneralSettings(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<GoalGeneralSetting>> {
		const { items }: IPagination<GoalGeneralSetting> = await this.goalGeneralSettingService.findAll({
			where: {}
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One policy of the caller's tenant.
	 *
	 * The read the inherited `GET /goal-general-setting/:id` route performs. A policy that is not there
	 * answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field that
	 * may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('goalGeneralSetting')
	async goalGeneralSetting(@Args('id', { type: () => ID }) id: Id): Promise<GoalGeneralSetting | null> {
		try {
			return await this.goalGeneralSettingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many policies the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('goalGeneralSettingCount')
	async goalGeneralSettingCount(): Promise<number> {
		return await this.goalGeneralSettingService.countBy();
	}

	/**
	 * Files a policy.
	 *
	 * The same service method the create route calls, with the body that route validates.
	 */
	@Mutation('createGoalGeneralSetting')
	async createGoalGeneralSetting(
		@Args('input') input: ICreateGoalGeneralSettingInput
	): Promise<GoalGeneralSetting> {
		return await this.goalGeneralSettingService.create(input as never);
	}

	/**
	 * Changes a policy.
	 *
	 * The delivered route is an update-through-create and this field is the same call with the stated
	 * identifier spread over the body. The delivered route wraps any failure in a bad request; that
	 * wrapper is a statement about the HTTP status this surface does not have, so the service's own
	 * refusal — which is a bad request already — travels instead.
	 */
	@Mutation('updateGoalGeneralSetting')
	async updateGoalGeneralSetting(
		@Args('input') input: IUpdateGoalGeneralSettingInput
	): Promise<GoalGeneralSetting> {
		const { id, ...values } = input;

		return await this.goalGeneralSettingService.create({ ...values, id } as never);
	}

	/**
	 * Removes a policy outright.
	 *
	 * The route is the CRUD base's own — the controller declares none — and it answers the store's
	 * delete result, a statement about the write rather than a row, so this field answers whether the
	 * removal ran.
	 */
	@Mutation('deleteGoalGeneralSetting')
	async deleteGoalGeneralSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.goalGeneralSettingService.delete(id);

		return true;
	}

	/**
	 * Withdraws a policy without removing it.
	 *
	 * The inherited `DELETE /goal-general-setting/:id/soft` route's own call.
	 */
	@Mutation('softDeleteGoalGeneralSetting')
	async softDeleteGoalGeneralSetting(@Args('id', { type: () => ID }) id: Id): Promise<GoalGeneralSetting> {
		return await this.goalGeneralSettingService.softRemove(id);
	}

	/**
	 * Puts a withdrawn policy back.
	 */
	@Mutation('recoverGoalGeneralSetting')
	async recoverGoalGeneralSetting(@Args('id', { type: () => ID }) id: Id): Promise<GoalGeneralSetting> {
		return await this.goalGeneralSettingService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly GoalGeneralSetting[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<GoalGeneralSetting> {
		return buildConnection<GoalGeneralSetting>({
			rows: rows ?? [],
			filterable: GOAL_GENERAL_SETTING_FILTERABLE,
			sortable: GOAL_GENERAL_SETTING_SORTABLE,
			defaultSort: GOAL_GENERAL_SETTING_DEFAULT_SORT,
			request
		});
	}
}
