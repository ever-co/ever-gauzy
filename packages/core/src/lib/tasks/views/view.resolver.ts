import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, ITaskView, ITaskViewFilterGroup, ITaskViewOrderInput, ITaskViewTasksPage, PermissionsEnum, TaskViewGroupBy } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { BaseQueryDTO } from '../../core/crud';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { RequestContext } from '../../core/context';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import { TaskViewTasksService } from './view-tasks.service';
import { TASK_VIEW_ORDER_MAX } from './dto/task-view-order.dto';
import { TaskViewsEnabledGuard } from '../task-views-enabled';
import { TaskViewCreateCommand, TaskViewUpdateCommand } from './commands';
import { Permissions } from '../../shared/decorators';
import { deleteRemovedRows } from '../../graphql/delete-answer';

/** The members `CreateTaskViewInput` declares in the schema. */
export interface ICreateTaskViewInput {
	organizationId: Id;
	name: string;
	description?: string;
	visibilityLevel?: number;
	queryParams?: Record<string, unknown>;
	filterOptions?: Record<string, unknown>;
	displayOptions?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	projectId?: Id;
	organizationTeamId?: Id;
	projectModuleId?: Id;
	organizationSprintId?: Id;
}

/** The members `UpdateTaskViewInput` declares in the schema. */
export interface IUpdateTaskViewInput extends Partial<ICreateTaskViewInput> {
	id: Id;
	/** The version the client read; the save is refused when the view moved on. */
	expectedVersion?: number | null;
}

/** The members `TaskViewOrderInput` declares in the schema. */
export interface ITaskViewOrderGraphqlInput {
	organizationId?: Id | null;
	taskIds: Id[];
	expectedVersion?: number | null;
}

/**
 * The fields a view list may be narrowed and sorted by, and the order it answers in when the caller
 * states none.
 *
 * The three document members — `queryParams`, `filterOptions` and `displayOptions` — are deliberately
 * in neither. They are documents rather than columns a caller narrows a list by, and the delivered
 * reader applies no order of its own, so the default here is the connection's decision: newest first,
 * with the identifier as the last key so that two views saved in the same millisecond still have one
 * order between them.
 */
const TASK_VIEW_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	visibilityLevel: 'NUMBER',
	projectId: 'ID',
	organizationTeamId: 'ID',
	projectModuleId: 'ID',
	organizationSprintId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TASK_VIEW_SORTABLE = ['createdAt', 'updatedAt', 'name', 'visibilityLevel'] as const;

/** The order the connection answers in when the caller states none. */
const TASK_VIEW_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The saved task filters over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TaskViewService` method the `/api/task-views` routes
 * call, or dispatches the same command its two writes dispatch — both of which run through the
 * service's own `create` and `update`, the two methods that write the activity log beside the row.
 *
 * **The guard chain is the controller's, and each field states the permission its route states.** The
 * delivered controller carries both guards on the class and no `@Permissions` on the class or on its
 * reads, so those run under the guards alone. Its writes state the task grants — `ORG_TASK_ADD` on the
 * creation and `ORG_TASK_EDIT` on the edit, the removal and the retire-and-restore pair it overrides
 * only to attach it — because `PermissionGuard` answers `true` to empty metadata, so any member of the
 * tenant could write a view (GHSA-v79w-54p2-wmh5). The fields state the same, neither wider nor narrower
 * than REST.
 *
 * **The replay of a view's older `queryParams` document is not a field of this resource.** It is the
 * `/api/tasks/view/:id` route's answer, which belongs to the task resource and is served there as
 * `tasksByView`; a second field here would be a second surface for one reader. The FR-3 reader —
 * `/api/task-views/:id/tasks`, the `filterOptions` tree with a keyset page and group counts — is this
 * resource's own route, and `taskViewTasks` is its twin here.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field.
 */
@Resolver('TaskView')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TaskViewResolver {
	constructor(
		private readonly taskViewService: TaskViewService,
		private readonly commandBus: CommandBus,
		private readonly viewTasks: TaskViewTasksService
	) {}

	/**
	 * The saved views of the caller's tenant.
	 *
	 * The controller serves the same rows a second time through the inherited `GET /pagination`, which
	 * is one capability and therefore this one field; the connection's own `limit`/`offset` already
	 * are the page that spelling performs.
	 */
	@Query('taskViews')
	async taskViews(
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
	): Promise<GraphqlConnection<TaskView>> {
		const { items }: IPagination<TaskView> = await this.taskViewService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<TaskView>);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One saved view, or null when there is none.
	 */
	@Query('taskView')
	async taskView(@Args('id', { type: () => ID }) id: Id): Promise<TaskView | null> {
		try {
			return await this.taskViewService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many saved views the caller's tenant holds.
	 */
	@Query('taskViewCount')
	async taskViewCount(): Promise<number> {
		return await this.taskViewService.countBy();
	}

	/**
	 * Saves a view: the same command the create route dispatches, through the service method that
	 * writes the activity log beside the row.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_ADD)
	@Mutation('createTaskView')
	async createTaskView(@Args('input') input: ICreateTaskViewInput): Promise<ITaskView> {
		return await this.commandBus.execute(new TaskViewCreateCommand(input as never));
	}

	/**
	 * Changes a saved view: the same command the edit route dispatches. The handler reads the row
	 * before it writes, so a view that is not there is a miss rather than a write under an identifier
	 * the caller does not own.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Mutation('updateTaskView')
	async updateTaskView(@Args('input') input: IUpdateTaskViewInput): Promise<ITaskView> {
		const { id, expectedVersion, ...values } = input;

		return await this.commandBus.execute(
			new TaskViewUpdateCommand(id, { ...values, ...(expectedVersion === null || expectedVersion === undefined ? {} : { expectedVersion }) } as never)
		);
	}

	/**
	 * Removes a saved view outright.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Mutation('deleteTaskView')
	async deleteTaskView(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		return deleteRemovedRows(await this.taskViewService.delete(id));
	}

	/**
	 * Retires a row without removing it, through the service method `DELETE /api/task-views/:id/soft` calls, under
	 * the permission that route states: `ORG_TASK_EDIT` (the task edit grant).
	 *
	 * The controller overrides the inherited route only to attach it — the CRUD base states none, and
	 * `PermissionGuard` answers `true` to empty metadata — so the field states the same, neither wider nor
	 * narrower than REST.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Mutation('softDeleteTaskView')
	async softDeleteTaskView(@Args('id', { type: () => ID }) id: Id): Promise<TaskView> {
		return await this.taskViewService.softRemove(id);
	}

	/**
	 * Restores a retired row through the service method `PUT /api/task-views/:id/recover` calls, under the
	 * permission that route states: `ORG_TASK_EDIT` (the task edit grant).
	 *
	 * The controller overrides the inherited route only to attach it — the CRUD base states none, and
	 * `PermissionGuard` answers `true` to empty metadata — so the field states the same, neither wider nor
	 * narrower than REST.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Mutation('recoverTaskView')
	async recoverTaskView(@Args('id', { type: () => ID }) id: Id): Promise<TaskView> {
		return await this.taskViewService.softRecover(id);
	}

	/**
	 * The tasks of a view (FR-3), through the reader `GET /task-views/:id/tasks` calls, under its permission
	 * and behind the task views switch (`TaskViewsEnabledGuard`, the route's own guard). A null argument is an
	 * absent one: the reader takes the view's own filter, grouping, organization and defaults for what the
	 * caller did not state, and the query's `filter` only when one is stated.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@UseGuards(TaskViewsEnabledGuard)
	@Query('taskViewTasks')
	async taskViewTasks(
		@Args('viewId', { type: () => ID }) viewId: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id | null,
		@Args('filter') filter?: ITaskViewFilterGroup | null,
		@Args('groupBy', { type: () => String, nullable: true }) groupBy?: TaskViewGroupBy | null,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string | null,
		@Args('cursor', { type: () => String, nullable: true }) cursor?: string | null,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number | null,
		@Args('relations', { type: () => [String], nullable: true }) relations?: string[] | null
	): Promise<ITaskViewTasksPage> {
		return await this.viewTasks.tasksOf(viewId, {
			organizationId: organizationId ?? undefined,
			filter: filter ?? undefined,
			groupBy: groupBy ?? undefined,
			timeZone: timeZone ?? undefined,
			cursor: cursor ?? undefined,
			limit: limit ?? undefined,
			relations: relations ?? undefined
		});
	}

	/**
	 * Writes the order a view shows its tasks in, through the method `PUT /task-views/:id/order` calls, under
	 * its permission and the task views switch. The cap is the route's DTO's (`TASK_VIEW_ORDER_MAX`); GraphQL
	 * runs no validator on its arguments, so it is stated here. The organization is the input's, else the
	 * credential's.
	 */
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@UseGuards(TaskViewsEnabledGuard)
	@Mutation('setTaskViewOrder')
	async setTaskViewOrder(@Args('id', { type: () => ID }) id: Id, @Args('input') input: ITaskViewOrderGraphqlInput): Promise<ITaskView> {
		const taskIds = Array.isArray(input?.taskIds) ? input.taskIds : [];
		if (taskIds.length > TASK_VIEW_ORDER_MAX) {
			throw new BadRequestException(`TASK_VIEW_ORDER_LIMIT_EXCEEDED: at most ${TASK_VIEW_ORDER_MAX} tasks in a manual order.`);
		}

		return await this.taskViewService.setOrder(id, {
			organizationId: input.organizationId ?? RequestContext.currentOrganizationId() ?? undefined,
			taskIds,
			expectedVersion: input.expectedVersion ?? undefined
		} as ITaskViewOrderInput);
	}

	/** The connection one list root field answers with. */
	private connection(
		rows: readonly TaskView[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<TaskView> {
		return buildConnection<TaskView>({
			rows: rows ?? [],
			filterable: TASK_VIEW_FILTERABLE,
			sortable: TASK_VIEW_SORTABLE,
			defaultSort: TASK_VIEW_DEFAULT_SORT,
			request
		});
	}
}
