import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, ITaskLinkedIssue, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { BaseQueryDTO } from '../../core/crud';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { TaskLinkedIssueCreateCommand, TaskLinkedIssueUpdateCommand } from './commands';

/** The members `CreateTaskLinkedIssueInput` declares in the schema. */
export interface ICreateTaskLinkedIssueInput {
	organizationId: Id;
	action: number;
	taskFromId: Id;
	taskToId: Id;
}

/** The members `UpdateTaskLinkedIssueInput` declares in the schema. */
export interface IUpdateTaskLinkedIssueInput {
	id: Id;
	organizationId: Id;
	action?: number;
	taskFromId?: Id;
	taskToId?: Id;
}

/**
 * The fields a link list may be narrowed and sorted by, and the order it answers in when the caller
 * states none.
 *
 * `taskFromId` and `taskToId` are the members that matter: a link is a fact about two tasks, so one
 * task's links are this connection narrowed on one end of the relation rather than a root field per
 * task. The reader applies no order of its own, so the default is the connection's decision — newest
 * first, with the identifier as the last key so that two links written in the same millisecond still
 * have one order between them.
 */
const TASK_LINKED_ISSUE_FILTERABLE = {
	id: 'ID',
	action: 'NUMBER',
	taskFromId: 'ID',
	taskToId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TASK_LINKED_ISSUE_SORTABLE = ['createdAt', 'updatedAt', 'action'] as const;

/** The order the connection answers in when the caller states none. */
const TASK_LINKED_ISSUE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * How one task relates to another, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TaskLinkedIssueService` method the
 * `/api/task-linked-issue` routes call, or dispatches the same command its two writes dispatch. Both
 * writes run through the service's own `create` and `update`, which are the methods that write the
 * activity log beside the row, so neither write is re-implemented here.
 *
 * **The guard chain and the permission are the controller's, field by field.** The delivered
 * controller carries both guards on the class and `ALL_ORG_EDIT` beside `ORG_TASK_EDIT` as its
 * class-level permission. Its list route states the view pair, its create states add, its update and
 * its soft removal state the class pair, its removal states delete, and the routes it inherits state
 * nothing of their own and therefore run under the class permission. Every field here states exactly
 * what its own route states, which is what keeps a caller who reaches a capability over one protocol
 * from being refused on the other.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field.
 */
@Resolver('TaskLinkedIssue')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
export class TaskLinkedIssueResolver {
	constructor(
		private readonly taskLinkedIssueService: TaskLinkedIssueService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The links between tasks the caller's tenant holds.
	 *
	 * One task's links are this connection with `taskFromId` or `taskToId` in `filter`. The controller
	 * serves the same rows a second time through the inherited `GET /pagination`, which is one
	 * capability and therefore this one field.
	 */
	@Query('taskLinkedIssues')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async taskLinkedIssues(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskLinkedIssue>> {
		const { items }: IPagination<TaskLinkedIssue> = await this.taskLinkedIssueService.findAll(
			{} as BaseQueryDTO<TaskLinkedIssue>
		);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One link, or null when there is none.
	 */
	@Query('taskLinkedIssue')
	async taskLinkedIssue(@Args('id', { type: () => ID }) id: Id): Promise<TaskLinkedIssue | null> {
		try {
			return await this.taskLinkedIssueService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many links the caller's tenant holds.
	 */
	@Query('taskLinkedIssueCount')
	async taskLinkedIssueCount(): Promise<number> {
		return await this.taskLinkedIssueService.countBy();
	}

	/**
	 * Links two tasks: the same command the create route dispatches, through the service method that
	 * writes the activity log beside the row.
	 */
	@Mutation('createTaskLinkedIssue')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	async createTaskLinkedIssue(@Args('input') input: ICreateTaskLinkedIssueInput): Promise<ITaskLinkedIssue> {
		return await this.commandBus.execute(new TaskLinkedIssueCreateCommand(input as never));
	}

	/**
	 * Changes an existing link: the same command the edit route dispatches, with the identifier in
	 * both places the delivered route carries it because the handler reads it off the command.
	 */
	@Mutation('updateTaskLinkedIssue')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	async updateTaskLinkedIssue(@Args('input') input: IUpdateTaskLinkedIssueInput): Promise<ITaskLinkedIssue> {
		const { id, ...values } = input;

		return await this.commandBus.execute(new TaskLinkedIssueUpdateCommand(id, values as never));
	}

	/**
	 * Removes a link outright, through the service method that writes the removal activity log.
	 */
	@Mutation('deleteTaskLinkedIssue')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	async deleteTaskLinkedIssue(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskLinkedIssueService.delete(id);

		return true;
	}

	/**
	 * Withdraws a link without removing it, through the service's own soft removal — which is the
	 * method this resource's `DELETE /:id/soft` route calls, and which writes the activity log too.
	 */
	@Mutation('softDeleteTaskLinkedIssue')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	async softDeleteTaskLinkedIssue(@Args('id', { type: () => ID }) id: Id): Promise<TaskLinkedIssue> {
		return (await this.taskLinkedIssueService.softDelete(id)) as TaskLinkedIssue;
	}

	/**
	 * Puts a withdrawn link back. The delivered route is inherited from the CRUD base and states no
	 * permission of its own, so this field states the class's.
	 */
	@Mutation('recoverTaskLinkedIssue')
	async recoverTaskLinkedIssue(@Args('id', { type: () => ID }) id: Id): Promise<TaskLinkedIssue> {
		return await this.taskLinkedIssueService.softRecover(id);
	}

	/** The connection one list root field answers with. */
	private connection(
		rows: readonly TaskLinkedIssue[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<TaskLinkedIssue> {
		return buildConnection<TaskLinkedIssue>({
			rows: rows ?? [],
			filterable: TASK_LINKED_ISSUE_FILTERABLE,
			sortable: TASK_LINKED_ISSUE_SORTABLE,
			defaultSort: TASK_LINKED_ISSUE_DEFAULT_SORT,
			request
		});
	}
}
