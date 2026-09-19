import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, ITaskView } from '@gauzy/contracts';
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
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import { TaskViewCreateCommand, TaskViewUpdateCommand } from './commands';

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
 * **The guard chain is the controller's, and no field states a permission, because no route states
 * one.** The delivered controller carries both guards on the class and no `@Permissions` at all —
 * not on the class and not on any of its five own routes — so every route this resolver mirrors runs
 * under the guards alone. A field that demanded a permission here would refuse a caller every one of
 * those routes serves, and tightening the resource is a change to make in both places at once rather
 * than in one.
 *
 * **The tasks a view selects are not a field of this resource.** They are the `/api/tasks/view/:id`
 * route's answer, which belongs to the task resource and is served there as `tasksByView`; a second
 * field here would be a second surface for one reader.
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
	constructor(private readonly taskViewService: TaskViewService, private readonly commandBus: CommandBus) {}

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
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskView>> {
		const { items }: IPagination<TaskView> = await this.taskViewService.findAll({} as BaseQueryDTO<TaskView>);

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
	@Mutation('createTaskView')
	async createTaskView(@Args('input') input: ICreateTaskViewInput): Promise<ITaskView> {
		return await this.commandBus.execute(new TaskViewCreateCommand(input as never));
	}

	/**
	 * Changes a saved view: the same command the edit route dispatches. The handler reads the row
	 * before it writes, so a view that is not there is a miss rather than a write under an identifier
	 * the caller does not own.
	 */
	@Mutation('updateTaskView')
	async updateTaskView(@Args('input') input: IUpdateTaskViewInput): Promise<ITaskView> {
		const { id, ...values } = input;

		return await this.commandBus.execute(new TaskViewUpdateCommand(id, values as never));
	}

	/**
	 * Removes a saved view outright.
	 */
	@Mutation('deleteTaskView')
	async deleteTaskView(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskViewService.delete(id);

		return true;
	}

	/**
	 * Withdraws a saved view without removing it. The delivered route is inherited from the CRUD base
	 * and states no permission of its own; the class states none either, so neither does this field.
	 */
	@Mutation('softDeleteTaskView')
	async softDeleteTaskView(@Args('id', { type: () => ID }) id: Id): Promise<TaskView> {
		return await this.taskViewService.softRemove(id);
	}

	/**
	 * Puts a withdrawn view back. Inherited for the same reason the withdrawal above is.
	 */
	@Mutation('recoverTaskView')
	async recoverTaskView(@Args('id', { type: () => ID }) id: Id): Promise<TaskView> {
		return await this.taskViewService.softRecover(id);
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
