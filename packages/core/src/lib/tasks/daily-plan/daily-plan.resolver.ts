import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IDailyPlan, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { BaseQueryDTO } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';
import { CreateDailyPlanDTO, RemoveTaskFromManyPlansDTO, UpdateDailyPlanDTO } from './dto';

/** The members `CreateDailyPlanInput` declares in the schema. */
export interface ICreateDailyPlanInput {
	organizationId: Id;
	date: Date;
	workTimePlanned: number;
	status: string;
	employeeId?: Id;
	organizationTeamId?: Id;
	taskId?: Id;
}

/** The members `UpdateDailyPlanInput` declares in the schema. */
export interface IUpdateDailyPlanInput {
	id: Id;
	organizationId: Id;
	date?: Date;
	workTimePlanned?: number;
	status?: string;
	employeeId?: Id;
	organizationTeamId?: Id;
}

/** The members `DailyPlanTaskInput` declares in the schema. */
export interface IDailyPlanTaskInput {
	organizationId: Id;
	taskId: Id;
	employeeId: Id;
}

/** The members `DailyPlanTaskRemovalInput` declares in the schema. */
export interface IDailyPlanTaskRemovalInput {
	organizationId: Id;
	employeeId: Id;
	planIds?: Id[];
}

/**
 * The fields a plan list may be narrowed and sorted by, and the order it answers in when the caller
 * states none.
 *
 * The plan's tasks are deliberately in neither: they live in the `daily_plan_task` pivot, which none
 * of the plan readers this surface mirrors joins, so a condition on them could only ever select the
 * empty set — the worst answer a filter can give. Which plans carry a task is `dailyPlansForTask`, a
 * root field of its own, answered by the one reader that does join the pivot. The default order is
 * the connection's own decision, because the readers apply none: newest first, with the identifier
 * as the last key so that two plans written in the same millisecond still have one order between
 * them.
 */
const DAILY_PLAN_FILTERABLE = {
	id: 'ID',
	date: 'DATE',
	workTimePlanned: 'NUMBER',
	status: 'STRING',
	employeeId: 'ID',
	organizationTeamId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const DAILY_PLAN_SORTABLE = ['createdAt', 'updatedAt', 'date', 'workTimePlanned', 'status'] as const;

/** The order the connection answers in when the caller states none. */
const DAILY_PLAN_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * One person's day of planned work over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `DailyPlanService` method the `/api/daily-plan` routes
 * call.
 *
 * **The guard chain and the permission are the controller's, field by field.** The delivered
 * controller carries both guards on the class and `ALL_ORG_EDIT` beside `DAILY_PLAN_UPDATE` as its
 * class-level permission. Its five reads state the view pair with the resource's own read
 * permission, its create states the create permission, its edit states the update permission, its
 * removal states the delete permission, its three membership writes state the create-and-update
 * pair, and the four routes it inherits from the CRUD base — the count, the paginated spelling, the
 * one-row query, the withdrawal and the recovery — state nothing of their own and therefore run
 * under the class pair. Every field here states exactly what its own route states.
 *
 * **The five reads are five readers, not one reader narrowed five ways.** Each joins a different
 * thing — the caller's own employee, the caller's team, one employee, or the plan-task pivot — and
 * the narrowing the caller states in a connection's `filter` cannot express any of them, because a
 * filter narrows rows and these narrow by who is asking or by a pivot the row does not carry. Each
 * is therefore a root field mirroring its own route, and the caller's own narrowing still arrives in
 * `filter` on every one of them.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field.
 */
@Resolver('DailyPlan')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_UPDATE)
export class DailyPlanResolver {
	constructor(private readonly dailyPlanService: DailyPlanService) {}

	/**
	 * The days planned in the caller's organization.
	 *
	 * The controller serves the same rows a second time through the inherited `GET /pagination`, which
	 * is one capability and therefore this one field.
	 */
	@Query('dailyPlans')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	async dailyPlans(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IDailyPlan>> {
		const { items }: IPagination<IDailyPlan> = await this.dailyPlanService.getAllPlans(
			this.scopedQuery()
		);

		return this.connection(items as DailyPlan[], { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The days planned for the caller.
	 *
	 * The delivered reader resolves the employee from the credential, so there is no argument here
	 * that could name someone else.
	 */
	@Query('myDailyPlans')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	async myDailyPlans(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IDailyPlan>> {
		const { items }: IPagination<IDailyPlan> = await this.dailyPlanService.getMyPlans(
			this.scopedQuery()
		);

		return this.connection(items as DailyPlan[], { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The days planned for the caller's team, which the delivered reader resolves from the
	 * credential.
	 */
	@Query('teamDailyPlans')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	async teamDailyPlans(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IDailyPlan>> {
		const { items }: IPagination<IDailyPlan> = await this.dailyPlanService.getTeamDailyPlans(
			this.scopedQuery()
		);

		return this.connection(items as DailyPlan[], { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The days planned for one employee.
	 */
	@Query('employeeDailyPlans')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	async employeeDailyPlans(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IDailyPlan>> {
		const { items }: IPagination<IDailyPlan> = await this.dailyPlanService.getDailyPlansByEmployee(
			this.scopedQuery(),
			employeeId
		);

		return this.connection(items as DailyPlan[], { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The plans one task is filed into.
	 *
	 * The inverse of a plan's own task list, and the only reader in this resource that joins the
	 * plan-task pivot — which is why it is a field of its own and why the pivot is not a filter on
	 * `dailyPlans`.
	 */
	@Query('dailyPlansForTask')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	async dailyPlansForTask(
		@Args('taskId', { type: () => ID }) taskId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IDailyPlan>> {
		const { items }: IPagination<IDailyPlan> = await this.dailyPlanService.getDailyPlansByTask(
			this.scopedQuery(),
			taskId
		);

		return this.connection(items as DailyPlan[], { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One planned day, or null when there is none. The route is inherited from the CRUD base and
	 * therefore runs under the class permission.
	 */
	@Query('dailyPlan')
	async dailyPlan(@Args('id', { type: () => ID }) id: Id): Promise<DailyPlan | null> {
		try {
			return await this.dailyPlanService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many planned days the caller's tenant holds. The route is inherited and runs under the
	 * class permission.
	 */
	@Query('dailyPlanCount')
	async dailyPlanCount(): Promise<number> {
		return await this.dailyPlanService.countBy();
	}

	/**
	 * Opens a day's plan.
	 */
	@Mutation('createDailyPlan')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_CREATE)
	async createDailyPlan(@Args('input') input: ICreateDailyPlanInput): Promise<IDailyPlan> {
		return await this.dailyPlanService.createDailyPlan(input as unknown as CreateDailyPlanDTO);
	}

	/**
	 * Changes a day's plan, answering the row the write produced.
	 */
	@Mutation('updateDailyPlan')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_UPDATE)
	async updateDailyPlan(@Args('input') input: IUpdateDailyPlanInput): Promise<IDailyPlan> {
		const { id, ...values } = input;

		return (await this.dailyPlanService.updateDailyPlan(id, values as unknown as UpdateDailyPlanDTO)) as IDailyPlan;
	}

	/**
	 * Removes a planned day outright.
	 */
	@Mutation('deleteDailyPlan')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_DELETE)
	async deleteDailyPlan(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.dailyPlanService.delete(id);

		return true;
	}

	/**
	 * Withdraws a planned day without removing it. The route is inherited and runs under the class
	 * permission.
	 */
	@Mutation('softDeleteDailyPlan')
	async softDeleteDailyPlan(@Args('id', { type: () => ID }) id: Id): Promise<DailyPlan> {
		return await this.dailyPlanService.softRemove(id);
	}

	/**
	 * Puts a withdrawn planned day back. Inherited for the same reason the withdrawal above is.
	 */
	@Mutation('recoverDailyPlan')
	async recoverDailyPlan(@Args('id', { type: () => ID }) id: Id): Promise<DailyPlan> {
		return await this.dailyPlanService.softRecover(id);
	}

	/**
	 * Files one task into one planned day: the same service method the delivered route calls, with
	 * the plan in the path as the delivered route carries it.
	 */
	@Mutation('addTaskToDailyPlan')
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_UPDATE
	)
	async addTaskToDailyPlan(
		@Args('planId', { type: () => ID }) planId: Id,
		@Args('input') input: IDailyPlanTaskInput
	): Promise<IDailyPlan> {
		return await this.dailyPlanService.addTaskToPlan(planId, input as never);
	}

	/**
	 * Takes one task out of one planned day.
	 */
	@Mutation('removeTaskFromDailyPlan')
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_UPDATE
	)
	async removeTaskFromDailyPlan(
		@Args('planId', { type: () => ID }) planId: Id,
		@Args('input') input: IDailyPlanTaskInput
	): Promise<IDailyPlan> {
		return await this.dailyPlanService.removeTaskFromPlan(planId, input as never);
	}

	/**
	 * Takes one task out of the plans it is in, for one employee, answering every plan it touched.
	 */
	@Mutation('removeTaskFromDailyPlans')
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_UPDATE
	)
	async removeTaskFromDailyPlans(
		@Args('taskId', { type: () => ID }) taskId: Id,
		@Args('input') input: IDailyPlanTaskRemovalInput
	): Promise<IDailyPlan[]> {
		return await this.dailyPlanService.removeTaskFromManyPlans(
			taskId,
			input as unknown as RemoveTaskFromManyPlansDTO
		);
	}

	/** The connection one list root field answers with. */
	private connection(
		rows: readonly DailyPlan[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<IDailyPlan> {
		return buildConnection<IDailyPlan>({
			rows: rows ?? [],
			filterable: DAILY_PLAN_FILTERABLE,
			sortable: DAILY_PLAN_SORTABLE,
			defaultSort: DAILY_PLAN_DEFAULT_SORT,
			request
		});
	}

	/**
	 * The query DTO the delivered readers take.
	 *
	 * Those readers read `options.where` before they read anything — the one that answers a task's
	 * plans destructures it outright — and the delivered clients fill it from the query string they
	 * send: the organization the board is showing, and nothing else on these five reads. A GraphQL
	 * caller states no scope at all, so the object is built with the organization the credential
	 * names, which is the value every client of those routes sends and the one value a caller cannot
	 * misstate. The caller's own narrowing still arrives in the connection's `filter`.
	 */
	private scopedQuery(): BaseQueryDTO<DailyPlan> {
		return {
			where: { organizationId: RequestContext.currentOrganizationId() ?? undefined }
		} as BaseQueryDTO<DailyPlan>;
	}
}
