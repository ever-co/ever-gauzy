import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard, PermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { deleteRemovedRows } from '../graphql/delete-answer';

/** The members `CreateGoalTimeFrameInput` declares in the schema. */
export interface ICreateGoalTimeFrameInput {
	name: string;
	status: string;
	startDate: Date;
	endDate: Date;
	organizationId?: Id;
}

/** The members `UpdateGoalTimeFrameInput` declares in the schema. */
export interface IUpdateGoalTimeFrameInput extends Partial<ICreateGoalTimeFrameInput> {
	id: Id;
}

/**
 * The fields a period list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `GoalTimeFrameFilter` and
 * `GoalTimeFrameSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `name` is filterable because the controller's own by-name route is stated that way: the route hands
 * the list reader one more criterion rather than reading a different thing, and a filter is that
 * criterion in this protocol's vocabulary.
 */
const GOAL_TIME_FRAME_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	status: 'STRING',
	startDate: 'DATE',
	endDate: 'DATE',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const GOAL_TIME_FRAME_SORTABLE = ['createdAt', 'updatedAt', 'name', 'status', 'startDate', 'endDate'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. A period is a span of time, so the order a caller means by default is the calendar's:
 * the period that opens first comes first, and the identifier is appended as the last key so that two
 * periods opening on the same day still have one order between them, which is what makes a cursor
 * walk over them stable.
 */
const GOAL_TIME_FRAME_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'startDate', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The period an objective is set for, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `GoalTimeFrameService` method the `/api/goal-time-frame`
 * routes call.
 *
 * **The by-name route is the connection narrowed.** The controller's own `GET /:name` calls the same
 * `findAll` reader the list route calls, handed `{ where: { name } }`, so it is stated as the
 * connection's `name` filter rather than as a root field of its own.
 *
 * **One fact about the delivered router is written down here rather than left to be discovered.**
 * A router walks a class's own methods before the base class's, so the controller's `GET /:name` is
 * registered ahead of the inherited `GET /count`, `GET /pagination` and `GET /:id`, and a
 * single-segment pattern matches every single-segment path: on REST those three answer a by-name list.
 * This surface states each capability where the controller declares it, because the capability is
 * what the controller declares and a registration order is not a narrowing anybody designed. The spec
 * asserts that ordering, so the note cannot quietly stop being true.
 *
 * **The guard chain is the controller's, and every write states `GOALS_EDIT`.** `GoalTimeFrameController`
 * carries `TenantPermissionGuard` on the class; its reads state no permission, and every write route — the
 * filing, the edit, the removal and the two lifecycle moves, the inherited ones overridden only to attach the
 * grant — states `GOALS_EDIT` behind `PermissionGuard` (owner decision 2, 2026-10-22: the writes stated none,
 * and the permission guard answers `true` to empty metadata, so any member of the tenant could write —
 * GHSA-v79w-54p2-wmh5). So this class carries the tenant guard and the gate, the reads state nothing, and
 * each write field states `PermissionGuard` and `GOALS_EDIT`, neither wider nor narrower than its route. The
 * spec reads the controller's `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's,
 * field by field.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('GoalTimeFrame')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class GoalTimeFrameResolver {
	constructor(private readonly goalTimeFrameService: GoalTimeFrameService) {}

	/**
	 * The periods of the caller's tenant.
	 *
	 * The same read the list route performs, and the same read the by-name route performs with one more
	 * criterion — which is why a period named by a caller is this connection with `name` in `filter`
	 * rather than a field of its own.
	 */
	@Query('goalTimeFrames')
	async goalTimeFrames(
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
	): Promise<GraphqlConnection<GoalTimeFrame>> {
		const { items }: IPagination<GoalTimeFrame> = await this.goalTimeFrameService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: {}
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One period of the caller's tenant.
	 *
	 * The capability the CRUD base's `GET /:id` route declares — see the note above the class for the
	 * registration order that puts the controller's by-name read in front of it on the delivered
	 * router. A period that is not there answers `null` rather than a refusal: GraphQL has one answer
	 * for "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('goalTimeFrame')
	async goalTimeFrame(@Args('id', { type: () => ID }) id: Id): Promise<GoalTimeFrame | null> {
		try {
			return await this.goalTimeFrameService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many periods the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('goalTimeFrameCount')
	async goalTimeFrameCount(): Promise<number> {
		return await this.goalTimeFrameService.countBy();
	}

	/**
	 * Opens a period.
	 *
	 * The same service method the create route calls, with the body that route validates.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Mutation('createGoalTimeFrame')
	async createGoalTimeFrame(@Args('input') input: ICreateGoalTimeFrameInput): Promise<GoalTimeFrame> {
		return await this.goalTimeFrameService.create(input as never);
	}

	/**
	 * Changes a period.
	 *
	 * The delivered route is an update-through-create and this field is the same call with the stated
	 * identifier spread over the body. The delivered route wraps any failure in a bad request; that
	 * wrapper is a statement about the HTTP status this surface does not have, so the service's own
	 * refusal — which is a bad request already — travels instead.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Mutation('updateGoalTimeFrame')
	async updateGoalTimeFrame(@Args('input') input: IUpdateGoalTimeFrameInput): Promise<GoalTimeFrame> {
		const { id, ...values } = input;

		return await this.goalTimeFrameService.create({ ...values, id } as never);
	}

	/**
	 * Removes a period outright.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Mutation('deleteGoalTimeFrame')
	async deleteGoalTimeFrame(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		return deleteRemovedRows(await this.goalTimeFrameService.delete(id));
	}

	/**
	 * Withdraws a period without removing it.
	 *
	 * The inherited `DELETE /goal-time-frame/:id/soft` route's own call.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Mutation('softDeleteGoalTimeFrame')
	async softDeleteGoalTimeFrame(@Args('id', { type: () => ID }) id: Id): Promise<GoalTimeFrame> {
		return await this.goalTimeFrameService.softRemove(id);
	}

	/**
	 * Puts a withdrawn period back.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Mutation('recoverGoalTimeFrame')
	async recoverGoalTimeFrame(@Args('id', { type: () => ID }) id: Id): Promise<GoalTimeFrame> {
		return await this.goalTimeFrameService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly GoalTimeFrame[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<GoalTimeFrame> {
		return buildConnection<GoalTimeFrame>({
			rows: rows ?? [],
			filterable: GOAL_TIME_FRAME_FILTERABLE,
			sortable: GOAL_TIME_FRAME_SORTABLE,
			defaultSort: GOAL_TIME_FRAME_DEFAULT_SORT,
			request
		});
	}
}
