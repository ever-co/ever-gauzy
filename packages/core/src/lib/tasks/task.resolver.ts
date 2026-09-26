import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IAdvancedTaskFiltering, ID as Id, IPagination, ITask, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';

/** The members `CreateTaskInput` declares in the schema. */
export interface ICreateTaskInput {
	organizationId: Id;
	title: string;
	description?: string;
	status?: string;
	priority?: string;
	size?: string;
	issueType?: string;
	estimate?: number;
	startDate?: Date;
	dueDate?: Date;
	resolvedAt?: Date;
	public?: boolean;
	version?: string;
	isDraft?: boolean;
	isScreeningTask?: boolean;
	parentId?: Id;
	projectId?: Id;
	organizationSprintId?: Id;
	taskStatusId?: Id;
	taskSizeId?: Id;
	taskPriorityId?: Id;
	taskTypeId?: Id;
	tagIds?: Id[];
	memberIds?: Id[];
	teamIds?: Id[];
	moduleIds?: Id[];
	mentionEmployeeIds?: Id[];
}

/** The members `UpdateTaskInput` declares in the schema. */
export interface IUpdateTaskInput extends ICreateTaskInput {
	id: Id;
	taskSprintMoveReason?: string;
}

/** The window and scope `tasksByDate` declares in the schema. */
export interface ITasksByDateInput {
	startDateFrom?: Date;
	startDateTo?: Date;
	dueDateFrom?: Date;
	dueDateTo?: Date;
	isScreeningTask?: boolean;
	createdByUserId?: Id;
	projectId?: Id;
	organizationSprintId?: Id;
}

/**
 * The fields a task list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TaskFilter` and `TaskSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the task row, because that is what the connection protocol evaluates:
 * the assignment, team and module pivots are **not** here. The delivered list reader does not join
 * them, so a condition on one would be evaluated against a row that carries none of it and would
 * select nothing at all — the worst answer a filter can give. Those three narrowings are the
 * `myTasks`, `employeeTasks`, `teamTasks` and `moduleTasks` root fields, each of which reaches a
 * reader that does join the pivot.
 */
const TASK_FILTERABLE = {
	id: 'ID',
	number: 'NUMBER',
	prefix: 'STRING',
	title: 'STRING',
	description: 'STRING',
	status: 'STRING',
	priority: 'STRING',
	size: 'STRING',
	issueType: 'STRING',
	estimate: 'NUMBER',
	startDate: 'DATE',
	dueDate: 'DATE',
	resolvedAt: 'DATE',
	public: 'BOOLEAN',
	version: 'STRING',
	isDraft: 'BOOLEAN',
	isScreeningTask: 'BOOLEAN',
	parentId: 'ID',
	projectId: 'ID',
	organizationSprintId: 'ID',
	taskStatusId: 'ID',
	taskSizeId: 'ID',
	taskPriorityId: 'ID',
	taskTypeId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TASK_SORTABLE = [
	'createdAt',
	'updatedAt',
	'number',
	'title',
	'startDate',
	'dueDate',
	'resolvedAt',
	'status',
	'priority',
	'size',
	'issueType',
	'estimate'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * Not one of the delivered readers states an order of its own: each hands the store a criterion and
 * takes the rows as they come back. This is therefore a decision the connection has to make rather
 * than one it reproduces — newest first, with the identifier as the last key so that two tasks filed
 * in the same millisecond still have one order between them, which is what makes a cursor walk over
 * them stable.
 */
const TASK_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The unit of work over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TaskService` method the `/api/tasks` routes call, or
 * dispatches the same `TaskCreateCommand` / `TaskUpdateCommand` the two writes dispatch.
 *
 * **The guard chain and the permission are the controller's, field by field.** The delivered
 * controller carries `TenantPermissionGuard` and `PermissionGuard` on the class and
 * `ALL_ORG_EDIT` as its class-level permission; each of its own routes then states what it runs
 * under, and every read states the view pair. This resolver therefore carries the same two guards on
 * the class — plus the gate — and every field states the permission its own route states, read off
 * the route rather than restated from a second list. The class-level permission is carried because
 * the controller carries it, and no field relies on it: every route this resolver mirrors states its
 * own, so every field does too.
 *
 * **The list is the connection and a sub-route is that connection narrowed**, with the three
 * exceptions the module comment in `task.api.gql` states: a pivot the list reader does not join gets
 * a root field of its own, and so does a projection the connection cannot state.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Task')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class TaskResolver {
	constructor(private readonly taskService: TaskService, private readonly commandBus: CommandBus) {}

	/**
	 * The tasks of the caller's organization, newest first.
	 *
	 * The same read the list route performs, with the same absence of narrowing: that route binds its
	 * query string to `BaseQueryDTO`, and this surface has no query string to bind — the connection
	 * protocol states the caller's narrowing in `filter`, which the evaluator applies to the rows the
	 * service returns. The controller serves the same rows a second time through the inherited
	 * `GET /pagination`; that is one capability, so it is this one field, and the connection's own
	 * `limit`/`offset` already are the page the paginated spelling performs.
	 */
	@Query('tasks')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async tasks(
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
	): Promise<GraphqlConnection<Task>> {
		// The read hands its options to the base read, which is what lifts the soft-delete filter, so the flag
		// belongs here rather than in the connection's request — the rows are read before it ever sees them.
		const { items }: IPagination<Task> = await this.taskService.findAll({
			...(withDeleted ? { withDeleted: true } : {})
		} as BaseQueryDTO<Task> & IAdvancedTaskFiltering);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks assigned to the caller.
	 *
	 * The read the `GET /tasks/me` route performs. It reaches `getEmployeeTasks`, whose reader joins
	 * the assignment pivot and resolves the employee from the credential — the branch the delivered
	 * reader takes for a caller without the permission to change the selected employee — so there is
	 * no argument here that could name someone else.
	 */
	@Query('myTasks')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async myTasks(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Task>> {
		const answer = await this.taskService.getMyTasks(this.scopedQuery());

		return this.connection(this.rowsOf(answer), { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks one employee holds.
	 *
	 * The read the `GET /tasks/employee/:id` route performs. The controller spells the same
	 * capability a second time — `GET /tasks/employee`, with the employee in the query string — and
	 * the two answer the tasks of one employee, which is one capability and therefore one field.
	 */
	@Query('employeeTasks')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async employeeTasks(
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
	): Promise<GraphqlConnection<Task>> {
		const answer = await this.taskService.getAllTasksByEmployee(employeeId, this.scopedQuery());

		return this.connection(this.rowsOf(answer), { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks a team works.
	 *
	 * The read the `GET /tasks/team` route performs. The team is resolved by the reader — for a
	 * caller without the permission to change the selected employee it is the caller's own team, and
	 * otherwise the teams the request context names — which is why it is stated as `filter`'s
	 * business and never as a scope argument here.
	 */
	@Query('teamTasks')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async teamTasks(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Task>> {
		const { items }: IPagination<Task> = await this.taskService.findTeamTasks(this.scopedQuery());

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks filed under a project module.
	 *
	 * The read the `GET /tasks/module` route performs, through the reader that joins the module
	 * pivot the list reader does not.
	 */
	@Query('moduleTasks')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async moduleTasks(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Task>> {
		const { items }: IPagination<Task> = await this.taskService.findModuleTasks(this.scopedQuery());

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks whose start or due date falls in the windows the caller states.
	 *
	 * A root field of its own rather than a filter on `tasks`, because the delivered reader carries a
	 * default the caller cannot state: it reads tasks that are not screening tasks unless it is told
	 * otherwise. The four bounds are handed to it as the delivered DTO hands them, and the caller's
	 * own narrowing still arrives in `filter`.
	 */
	@Query('tasksByDate')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async tasksByDate(
		@Args('startDateFrom', { type: () => Date, nullable: true }) startDateFrom?: Date,
		@Args('startDateTo', { type: () => Date, nullable: true }) startDateTo?: Date,
		@Args('dueDateFrom', { type: () => Date, nullable: true }) dueDateFrom?: Date,
		@Args('dueDateTo', { type: () => Date, nullable: true }) dueDateTo?: Date,
		@Args('isScreeningTask', { type: () => Boolean, nullable: true }) isScreeningTask?: boolean,
		@Args('createdByUserId', { type: () => ID, nullable: true }) createdByUserId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('organizationSprintId', { type: () => ID, nullable: true }) organizationSprintId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Task>> {
		const { items }: IPagination<Task> = await this.taskService.getTasksByDateFilters({
			...this.scopeOfTheCaller(),
			startDateFrom,
			startDateTo,
			dueDateFrom,
			dueDateTo,
			isScreeningTask,
			createdByUserId,
			projectId,
			organizationSprintId
		});

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * The tasks a saved view selects.
	 *
	 * A projection the connection cannot state: the delivered reader loads the view's stored filter
	 * set and replays it, so the narrowing is a fact about a row rather than about the request. The
	 * view whose filter is replayed is the argument, and the reader scopes it by the credential's
	 * tenant.
	 */
	@Query('tasksByView')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async tasksByView(
		@Args('viewId', { type: () => ID }) viewId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Task>> {
		const { items }: IPagination<ITask> = await this.taskService.findTasksByViewQuery(viewId);

		return this.connection((items ?? []) as Task[], {
			filter,
			sort,
			page,
			first,
			after,
			last,
			before,
			limit,
			offset
		});
	}

	/**
	 * One task of the caller's tenant.
	 *
	 * A task that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('task')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async task(
		@Args('id', { type: () => ID }) id: Id,
		@Args('includeRootEpic', { type: () => Boolean, nullable: true }) includeRootEpic?: boolean
	): Promise<Task | null> {
		try {
			return (await this.taskService.findById(id, { includeRootEpic } as never)) as Task;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many tasks the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows.
	 */
	@Query('taskCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async taskCount(): Promise<number> {
		return await this.taskService.countBy();
	}

	/**
	 * The highest task number in a project.
	 *
	 * A projection the connection cannot state — a maximum rather than a membership test — so it is a
	 * field of its own, mirroring `GET /tasks/max-number`. The delivered route takes the project and
	 * the organization from its query string; this field takes the project from the caller and the
	 * organization from the credential, which is the value the route's own clients send.
	 */
	@Query('taskMaxNumber')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	async taskMaxNumber(@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id): Promise<number> {
		return await this.taskService.getMaxTaskNumberByProject({
			...this.scopeOfTheCaller(),
			projectId: projectId ?? null
		} as never);
	}

	/**
	 * Files a task.
	 *
	 * The same command the create route dispatches. The relations the caller states as identifiers
	 * are handed over as the rows the delivered handler reads, which is the shape its own body has.
	 */
	@Mutation('createTask')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	async createTask(@Args('input') input: ICreateTaskInput): Promise<ITask> {
		return await this.commandBus.execute(new TaskCreateCommand(this.payload(input) as never));
	}

	/**
	 * Edits a task that exists.
	 *
	 * The same command the edit route dispatches, with the identifier in both places the delivered
	 * route carries it — the path and the body — because the handler reads it off the command. The
	 * dispatched update reads the row before it writes, so a task that is not there is a miss rather
	 * than a write under an identifier the caller does not own.
	 */
	@Mutation('updateTask')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	async updateTask(@Args('input') input: IUpdateTaskInput): Promise<ITask> {
		// The identifier is the criterion and is not repeated in the payload, which is the shape the
		// delivered route has: `:id` names the row and the body carries only what changes.
		const { id, ...values } = input;

		return await this.commandBus.execute(new TaskUpdateCommand(id, this.payload(values) as never));
	}

	/**
	 * Removes a task outright, with the rows that hang off it.
	 */
	@Mutation('deleteTask')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	async deleteTask(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskService.delete(id);

		return true;
	}

	/**
	 * Takes one employee off every task of one team.
	 *
	 * The same service method the delivered route calls. The route answers nothing at all — its own
	 * controller types the answer `void` — so this field answers whether the call ran, which is the
	 * most the route's answer carries; a caller that needs the tasks themselves reads them back
	 * through `teamTasks`.
	 */
	@Mutation('unassignEmployeeFromTeamTasks')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	async unassignEmployeeFromTeamTasks(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('organizationTeamId', { type: () => ID }) organizationTeamId: Id
	): Promise<boolean> {
		await this.taskService.unassignEmployeeFromTeamTasks(employeeId, organizationTeamId);

		return true;
	}

	/**
	 * The payload the delivered create and edit handlers read.
	 *
	 * A related row is carried as the identifier the write persists — the label, the member, the team
	 * and the module are named by their identifiers and handed over as the rows the pivots are
	 * written from — and a list the caller did not state stays `undefined` rather than becoming `[]`,
	 * because the handler reads "no members stated" and "no members" as different instructions.
	 */
	private payload(input: Omit<IUpdateTaskInput, 'id'> | ICreateTaskInput): Record<string, unknown> {
		const { tagIds, memberIds, teamIds, moduleIds, ...data } = input;

		return {
			...data,
			tags: tagIds?.map((value) => ({ id: value })),
			members: memberIds?.map((value) => ({ id: value })),
			teams: teamIds?.map((value) => ({ id: value })),
			modules: moduleIds?.map((value) => ({ id: value }))
		};
	}

	/**
	 * The narrowing every reader below shares: the caller's own tenant and organization.
	 *
	 * The delivered clients send both in the query string — the task screen scopes every read to the
	 * organization it is showing — and the readers build their criterion from what they are handed.
	 * A GraphQL caller states no scope at all, so it is read from the credential, which is the one
	 * value a caller cannot misstate: the strategy that validates the token is what put it there,
	 * against the caller's own memberships.
	 */
	private scopeOfTheCaller(): { tenantId?: Id; organizationId?: Id } {
		return {
			tenantId: RequestContext.currentTenantId() ?? undefined,
			organizationId: RequestContext.currentOrganizationId() ?? undefined
		};
	}

	/**
	 * The query DTO the delivered readers take.
	 *
	 * Those readers destructure `options.where` before they read anything, so an absent one is a
	 * refusal rather than an unscoped read: the object the route builds from its query string is
	 * handed over with the credential's organization and nothing else, and the caller's own narrowing
	 * still arrives in the connection's `filter`.
	 */
	private scopedQuery(): BaseQueryDTO<Task> {
		return { where: { organizationId: RequestContext.currentOrganizationId() ?? undefined } } as BaseQueryDTO<Task>;
	}

	/**
	 * The rows of an answer, whichever envelope the delivered reader used.
	 *
	 * The readers this domain has answer in two shapes: the paginated ones answer `{ items, total }`,
	 * and the one that reads an employee's tasks answers the rows themselves on one ORM and the
	 * envelope on the other. Both are the same set, so the connection is handed the set.
	 */
	private rowsOf(answer: IPagination<ITask> | ITask[] | Task[] | undefined): Task[] {
		if (Array.isArray(answer)) {
			return answer as Task[];
		}

		return ((answer as IPagination<ITask>)?.items ?? []) as Task[];
	}

	/**
	 * The connection one list root field answers with, built by the one implementation every domain
	 * on this platform shares.
	 */
	private connection(rows: readonly Task[] | undefined, request: ConnectionRequest): GraphqlConnection<Task> {
		return buildConnection<Task>({
			rows: rows ?? [],
			filterable: TASK_FILTERABLE,
			sortable: TASK_SORTABLE,
			defaultSort: TASK_DEFAULT_SORT,
			request
		});
	}
}
