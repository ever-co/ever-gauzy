import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, ITaskMetadataBootstrapResponse, TaskMetadataSection } from '@gauzy/contracts';
import {
	ConnectionFieldKind,
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { API_QUERY_LIMITS } from '../api/query-ast';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TagService } from '../tags/tag.service';
import { Tag } from '../tags/tag.entity';
import { IssueType } from './issue-type/issue-type.entity';
import { IssueTypeService } from './issue-type/issue-type.service';
import { TaskPriority } from './priorities/priority.entity';
import { TaskPriorityService } from './priorities/priority.service';
import { TaskRelatedIssueType } from './related-issue-type/related-issue-type.entity';
import { TaskRelatedIssueTypeService } from './related-issue-type/related-issue-type.service';
import { TaskSize } from './sizes/size.entity';
import { TaskSizeService } from './sizes/size.service';
import { TaskStatus } from './statuses/status.entity';
import { TaskStatusService } from './statuses/status.service';
import { TaskVersion } from './versions/version.entity';
import { TaskVersionService } from './versions/version.service';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap/task-metadata-bootstrap.service';

/** The scope one vocabulary row is read in, and the scope a default is marked in. */
export interface ITaskMetadataScope {
	organizationId?: Id;
	organizationTeamId?: Id;
	projectId?: Id;
}

/** The members `CreateTaskStatusInput` declares in the schema. */
export interface ICreateTaskStatusInput extends ITaskMetadataScope {
	name: string;
	value: string;
	description?: string;
	order?: number;
	icon?: string;
	color?: string;
	isCollapsed?: boolean;
	isDefault?: boolean;
	isTodo?: boolean;
	isInProgress?: boolean;
	isDone?: boolean;
	template?: string;
}

/** The members `UpdateTaskStatusInput` declares in the schema. */
export interface IUpdateTaskStatusInput extends Partial<ICreateTaskStatusInput> {
	id: Id;
}

/** The members `CreateTaskSizeInput` declares in the schema. */
export interface ICreateTaskSizeInput extends ITaskMetadataScope {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
}

/** The members `UpdateTaskSizeInput` declares in the schema. */
export interface IUpdateTaskSizeInput extends Partial<ICreateTaskSizeInput> {
	id: Id;
}

/** The members `CreateTaskPriorityInput` declares in the schema. */
export interface ICreateTaskPriorityInput extends ICreateTaskSizeInput {}

/** The members `UpdateTaskPriorityInput` declares in the schema. */
export interface IUpdateTaskPriorityInput extends IUpdateTaskSizeInput {}

/** The members `CreateTaskVersionInput` declares in the schema. */
export interface ICreateTaskVersionInput extends ICreateTaskSizeInput {}

/** The members `UpdateTaskVersionInput` declares in the schema. */
export interface IUpdateTaskVersionInput extends IUpdateTaskSizeInput {}

/** The members `CreateIssueTypeInput` declares in the schema. */
export interface ICreateIssueTypeInput extends ITaskMetadataScope {
	name: string;
	description?: string;
	icon?: string;
	color?: string;
	isDefault?: boolean;
	imageId?: Id;
}

/** The members `UpdateIssueTypeInput` declares in the schema. */
export interface IUpdateIssueTypeInput extends Partial<ICreateIssueTypeInput> {
	id: Id;
}

/** The members `CreateTaskRelatedIssueTypeInput` declares in the schema. */
export interface ICreateTaskRelatedIssueTypeInput extends ICreateTaskSizeInput {}

/** The members `UpdateTaskRelatedIssueTypeInput` declares in the schema. */
export interface IUpdateTaskRelatedIssueTypeInput extends IUpdateTaskSizeInput {}

/** One step of a status reordering, as `TaskStatusOrderInput` declares it. */
export interface ITaskStatusOrderInput {
	id: Id;
	order: number;
}

/** One reading of a vocabulary row, as the connection protocol states it. */
interface IListRequest {
	filter?: ConnectionFilter;
	sort?: ConnectionSortKey[];
	page?: ConnectionPageRequest;
	first?: number;
	after?: string;
	last?: number;
	before?: string;
	limit?: number;
	offset?: number;
}

/**
 * The order every vocabulary connection answers in when the caller states none.
 *
 * The six resources share one shape and therefore one order: none of the delivered readers states an
 * order of its own — each hands the store a criterion and takes the rows as they come back — so this
 * is a decision the connection has to make rather than one it reproduces. Newest first, with the
 * identifier as the last key so two rows written in the same millisecond still have one order between
 * them, which is what makes a cursor walk over them stable. A status carries an `order` column of its
 * own, which a caller sorts by when the board wants the operator's order rather than the store's.
 */
const METADATA_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/** The fields a status list may be narrowed by. */
const STATUS_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	value: 'STRING',
	description: 'STRING',
	order: 'NUMBER',
	icon: 'STRING',
	color: 'STRING',
	isSystem: 'BOOLEAN',
	isCollapsed: 'BOOLEAN',
	isDefault: 'BOOLEAN',
	isTodo: 'BOOLEAN',
	isInProgress: 'BOOLEAN',
	isDone: 'BOOLEAN',
	projectId: 'ID',
	organizationTeamId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the status sort enum offers. */
const STATUS_SORTABLE = ['createdAt', 'updatedAt', 'name', 'value', 'order', 'isSystem'] as const;

/**
 * The fields the four icon-and-colour vocabularies may be narrowed by.
 *
 * One declaration, four readings: a size, a priority, a version and a related-issue type are the same
 * row — a name, a stable value, an icon, a colour and whether the platform maintains it — so the
 * fields a caller may narrow them by are the same fields, and stating them once is what keeps the
 * four connections from drifting apart.
 */
const ICONIC_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	value: 'STRING',
	description: 'STRING',
	icon: 'STRING',
	color: 'STRING',
	isSystem: 'BOOLEAN',
	projectId: 'ID',
	organizationTeamId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the four icon-and-colour sort enums offer. */
const ICONIC_SORTABLE = ['createdAt', 'updatedAt', 'name', 'value', 'isSystem'] as const;

/** The fields an issue-type list may be narrowed by: the four above, plus its two own columns. */
const ISSUE_TYPE_FILTERABLE = {
	...ICONIC_FILTERABLE,
	isDefault: 'BOOLEAN',
	imageId: 'ID'
} as const;

/** The fields the issue-type sort enum offers. */
const ISSUE_TYPE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'value', 'isDefault', 'isSystem'] as const;

/**
 * The vocabulary a task points at, over GraphQL.
 *
 * **Why these six resources are one resolver.** They are one shape repeated: every one of the six
 * controllers extends the same `CrudFactory` with the same five DTO slots, every one of the six
 * services extends the same `TaskMetadataService`, and every one of the six answers the same nine
 * routes — the list, the paginated spelling of it, the count, the row, and the five writes. They
 * carry one guard chain (`TenantPermissionGuard` alone, with no class-level and no handler-level
 * permission on any of the six) and one read: the reader that falls back to the installation's own
 * system rows when the scope a caller named holds none. Splitting them across six resolver classes
 * would state that one declaration six times and would let five of the six drift; keeping them in one
 * class is what makes the shared connection order, the shared filterable vocabulary and — most of all
 * — the shared guard chain one statement rather than six copies of it.
 *
 * The six are also one concept to the platform: a task points at all of them by identifier, the six
 * columns sit side by side on the task row, and the delivered relation this resource is served under
 * is named `task-metadata` because a board needs the whole vocabulary before it can render a task
 * form.
 *
 * **The guard chain is the controllers', and no field states a permission.** All six controllers
 * carry the tenant guard on the class and nothing else: not a class-level permission and not a
 * handler-level one. The permission guard is not part of their chain at all, so it is not part of
 * this one either — a field that demanded a permission here would refuse a caller every one of those
 * six routes serves.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TaskMetadataResolver {
	constructor(
		private readonly taskStatusService: TaskStatusService,
		private readonly taskSizeService: TaskSizeService,
		private readonly taskPriorityService: TaskPriorityService,
		private readonly taskVersionService: TaskVersionService,
		private readonly issueTypeService: IssueTypeService,
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypeService,
		private readonly tagService: TagService,
		private readonly bootstrapService: TaskMetadataBootstrapService
	) {}

	// ---------------------------------------------------------------------------------------------
	// The lifecycle states a task can be in
	// ---------------------------------------------------------------------------------------------

	/**
	 * The statuses of the caller's scope.
	 *
	 * The read the list route performs: the delivered controller dispatches `FindStatusesQuery`, whose
	 * handler calls this same `fetchAll` reader and nothing else, so the field reaches the reader by
	 * the shorter path rather than restating the bus. The caller's own narrowing arrives in `filter`.
	 */
	@Query('taskStatuses')
	async taskStatuses(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskStatus>> {
		const { items }: IPagination<TaskStatus> = await this.taskStatusService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, STATUS_FILTERABLE, STATUS_SORTABLE, {
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
	 * One status, or null when there is none.
	 */
	@Query('taskStatus')
	async taskStatus(@Args('id', { type: () => ID }) id: Id): Promise<TaskStatus | null> {
		return await this.oneOrNone(this.taskStatusService, id);
	}

	/**
	 * How many statuses the caller's tenant holds.
	 */
	@Query('taskStatusCount')
	async taskStatusCount(): Promise<number> {
		return await this.taskStatusService.countBy();
	}

	/**
	 * Files a status. The delivered write merges the workflow the caller's `template` names onto the
	 * row, which is why the template is a member of the write and of no column.
	 */
	@Mutation('createTaskStatus')
	async createTaskStatus(@Args('input') input: ICreateTaskStatusInput): Promise<TaskStatus> {
		return (await this.taskStatusService.create(input as never)) as TaskStatus;
	}

	/** Changes a status, answering the row the write produced. */
	@Mutation('updateTaskStatus')
	async updateTaskStatus(@Args('input') input: IUpdateTaskStatusInput): Promise<TaskStatus> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.taskStatusService, id, values);
	}

	/** Removes a status outright. A status the platform maintains is the store's to refuse. */
	@Mutation('deleteTaskStatus')
	async deleteTaskStatus(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskStatusService.delete(id);

		return true;
	}

	/** Withdraws a status without removing it. */
	@Mutation('softDeleteTaskStatus')
	async softDeleteTaskStatus(@Args('id', { type: () => ID }) id: Id): Promise<TaskStatus> {
		return (await this.taskStatusService.softRemove(id)) as TaskStatus;
	}

	/** Puts a withdrawn status back. */
	@Mutation('recoverTaskStatus')
	async recoverTaskStatus(@Args('id', { type: () => ID }) id: Id): Promise<TaskStatus> {
		return (await this.taskStatusService.softRecover(id)) as TaskStatus;
	}

	/**
	 * Writes the board's column order for a set of statuses.
	 *
	 * The same service method the reorder route calls, with the list the delivered body carries. The
	 * answer is the route's own — whether it succeeded, and the list it wrote — because the route
	 * answers a statement about the write rather than a row.
	 */
	@Mutation('reorderTaskStatuses')
	async reorderTaskStatuses(
		@Args('reorder') reorder: ITaskStatusOrderInput[]
	): Promise<{ success: boolean; list?: ITaskStatusOrderInput[] }> {
		return await this.taskStatusService.reorder(reorder as never);
	}

	/**
	 * Makes one status the default of one scope, and answers every status of that scope back — which
	 * is what the delivered route answers, because the write clears the mark from the others.
	 */
	@Mutation('markTaskStatusAsDefault')
	async markTaskStatusAsDefault(
		@Args('id', { type: () => ID }) id: Id,
		@Args('scope') scope: ITaskMetadataScope
	): Promise<TaskStatus[]> {
		return (await this.taskStatusService.markAsDefault(id, scope as never)) as TaskStatus[];
	}

	// ---------------------------------------------------------------------------------------------
	// The four icon-and-colour vocabularies
	// ---------------------------------------------------------------------------------------------

	/** The sizes of the caller's scope. */
	@Query('taskSizes')
	async taskSizes(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskSize>> {
		const { items }: IPagination<TaskSize> = await this.taskSizeService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, ICONIC_FILTERABLE, ICONIC_SORTABLE, {
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

	/** One size, or null when there is none. */
	@Query('taskSize')
	async taskSize(@Args('id', { type: () => ID }) id: Id): Promise<TaskSize | null> {
		return await this.oneOrNone(this.taskSizeService, id);
	}

	/** How many sizes the caller's tenant holds. */
	@Query('taskSizeCount')
	async taskSizeCount(): Promise<number> {
		return await this.taskSizeService.countBy();
	}

	/** Files a size. */
	@Mutation('createTaskSize')
	async createTaskSize(@Args('input') input: ICreateTaskSizeInput): Promise<TaskSize> {
		return (await this.taskSizeService.create(input as never)) as TaskSize;
	}

	/** Changes a size, answering the row the write produced. */
	@Mutation('updateTaskSize')
	async updateTaskSize(@Args('input') input: IUpdateTaskSizeInput): Promise<TaskSize> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.taskSizeService, id, values);
	}

	/** Removes a size outright. */
	@Mutation('deleteTaskSize')
	async deleteTaskSize(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskSizeService.delete(id);

		return true;
	}

	/** Withdraws a size without removing it. */
	@Mutation('softDeleteTaskSize')
	async softDeleteTaskSize(@Args('id', { type: () => ID }) id: Id): Promise<TaskSize> {
		return (await this.taskSizeService.softRemove(id)) as TaskSize;
	}

	/** Puts a withdrawn size back. */
	@Mutation('recoverTaskSize')
	async recoverTaskSize(@Args('id', { type: () => ID }) id: Id): Promise<TaskSize> {
		return (await this.taskSizeService.softRecover(id)) as TaskSize;
	}

	/** The priorities of the caller's scope. */
	@Query('taskPriorities')
	async taskPriorities(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskPriority>> {
		const { items }: IPagination<TaskPriority> = await this.taskPriorityService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, ICONIC_FILTERABLE, ICONIC_SORTABLE, {
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

	/** One priority, or null when there is none. */
	@Query('taskPriority')
	async taskPriority(@Args('id', { type: () => ID }) id: Id): Promise<TaskPriority | null> {
		return await this.oneOrNone(this.taskPriorityService, id);
	}

	/** How many priorities the caller's tenant holds. */
	@Query('taskPriorityCount')
	async taskPriorityCount(): Promise<number> {
		return await this.taskPriorityService.countBy();
	}

	/** Files a priority. */
	@Mutation('createTaskPriority')
	async createTaskPriority(@Args('input') input: ICreateTaskPriorityInput): Promise<TaskPriority> {
		return (await this.taskPriorityService.create(input as never)) as TaskPriority;
	}

	/** Changes a priority, answering the row the write produced. */
	@Mutation('updateTaskPriority')
	async updateTaskPriority(@Args('input') input: IUpdateTaskPriorityInput): Promise<TaskPriority> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.taskPriorityService, id, values);
	}

	/** Removes a priority outright. */
	@Mutation('deleteTaskPriority')
	async deleteTaskPriority(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskPriorityService.delete(id);

		return true;
	}

	/** Withdraws a priority without removing it. */
	@Mutation('softDeleteTaskPriority')
	async softDeleteTaskPriority(@Args('id', { type: () => ID }) id: Id): Promise<TaskPriority> {
		return (await this.taskPriorityService.softRemove(id)) as TaskPriority;
	}

	/** Puts a withdrawn priority back. */
	@Mutation('recoverTaskPriority')
	async recoverTaskPriority(@Args('id', { type: () => ID }) id: Id): Promise<TaskPriority> {
		return (await this.taskPriorityService.softRecover(id)) as TaskPriority;
	}

	/** The versions of the caller's scope. */
	@Query('taskVersions')
	async taskVersions(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskVersion>> {
		const { items }: IPagination<TaskVersion> = await this.taskVersionService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, ICONIC_FILTERABLE, ICONIC_SORTABLE, {
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

	/** One version, or null when there is none. */
	@Query('taskVersion')
	async taskVersion(@Args('id', { type: () => ID }) id: Id): Promise<TaskVersion | null> {
		return await this.oneOrNone(this.taskVersionService, id);
	}

	/** How many versions the caller's tenant holds. */
	@Query('taskVersionCount')
	async taskVersionCount(): Promise<number> {
		return await this.taskVersionService.countBy();
	}

	/** Files a version. */
	@Mutation('createTaskVersion')
	async createTaskVersion(@Args('input') input: ICreateTaskVersionInput): Promise<TaskVersion> {
		return (await this.taskVersionService.create(input as never)) as TaskVersion;
	}

	/** Changes a version, answering the row the write produced. */
	@Mutation('updateTaskVersion')
	async updateTaskVersion(@Args('input') input: IUpdateTaskVersionInput): Promise<TaskVersion> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.taskVersionService, id, values);
	}

	/** Removes a version outright. */
	@Mutation('deleteTaskVersion')
	async deleteTaskVersion(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskVersionService.delete(id);

		return true;
	}

	/** Withdraws a version without removing it. */
	@Mutation('softDeleteTaskVersion')
	async softDeleteTaskVersion(@Args('id', { type: () => ID }) id: Id): Promise<TaskVersion> {
		return (await this.taskVersionService.softRemove(id)) as TaskVersion;
	}

	/** Puts a withdrawn version back. */
	@Mutation('recoverTaskVersion')
	async recoverTaskVersion(@Args('id', { type: () => ID }) id: Id): Promise<TaskVersion> {
		return (await this.taskVersionService.softRecover(id)) as TaskVersion;
	}

	/** The related-issue types of the caller's scope. */
	@Query('taskRelatedIssueTypes')
	async taskRelatedIssueTypes(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TaskRelatedIssueType>> {
		const { items }: IPagination<TaskRelatedIssueType> = await this.taskRelatedIssueTypeService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, ICONIC_FILTERABLE, ICONIC_SORTABLE, {
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

	/** One related-issue type, or null when there is none. */
	@Query('taskRelatedIssueType')
	async taskRelatedIssueType(@Args('id', { type: () => ID }) id: Id): Promise<TaskRelatedIssueType | null> {
		return await this.oneOrNone(this.taskRelatedIssueTypeService, id);
	}

	/** How many related-issue types the caller's tenant holds. */
	@Query('taskRelatedIssueTypeCount')
	async taskRelatedIssueTypeCount(): Promise<number> {
		return await this.taskRelatedIssueTypeService.countBy();
	}

	/** Files a related-issue type. */
	@Mutation('createTaskRelatedIssueType')
	async createTaskRelatedIssueType(
		@Args('input') input: ICreateTaskRelatedIssueTypeInput
	): Promise<TaskRelatedIssueType> {
		return (await this.taskRelatedIssueTypeService.create(input as never)) as TaskRelatedIssueType;
	}

	/** Changes a related-issue type, answering the row the write produced. */
	@Mutation('updateTaskRelatedIssueType')
	async updateTaskRelatedIssueType(
		@Args('input') input: IUpdateTaskRelatedIssueTypeInput
	): Promise<TaskRelatedIssueType> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.taskRelatedIssueTypeService, id, values);
	}

	/** Removes a related-issue type outright. */
	@Mutation('deleteTaskRelatedIssueType')
	async deleteTaskRelatedIssueType(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.taskRelatedIssueTypeService.delete(id);

		return true;
	}

	/** Withdraws a related-issue type without removing it. */
	@Mutation('softDeleteTaskRelatedIssueType')
	async softDeleteTaskRelatedIssueType(@Args('id', { type: () => ID }) id: Id): Promise<TaskRelatedIssueType> {
		return (await this.taskRelatedIssueTypeService.softRemove(id)) as TaskRelatedIssueType;
	}

	/** Puts a withdrawn related-issue type back. */
	@Mutation('recoverTaskRelatedIssueType')
	async recoverTaskRelatedIssueType(@Args('id', { type: () => ID }) id: Id): Promise<TaskRelatedIssueType> {
		return (await this.taskRelatedIssueTypeService.softRecover(id)) as TaskRelatedIssueType;
	}

	// ---------------------------------------------------------------------------------------------
	// The kinds of work a task can be
	// ---------------------------------------------------------------------------------------------

	/** The issue types of the caller's scope. */
	@Query('issueTypes')
	async issueTypes(
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IssueType>> {
		const { items }: IPagination<IssueType> = await this.issueTypeService.fetchAll(
			this.scope({ organizationTeamId, projectId })
		);

		return this.connection(items, ISSUE_TYPE_FILTERABLE, ISSUE_TYPE_SORTABLE, {
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

	/** One issue type, or null when there is none. */
	@Query('issueType')
	async issueType(@Args('id', { type: () => ID }) id: Id): Promise<IssueType | null> {
		return await this.oneOrNone(this.issueTypeService, id);
	}

	/** How many issue types the caller's tenant holds. */
	@Query('issueTypeCount')
	async issueTypeCount(): Promise<number> {
		return await this.issueTypeService.countBy();
	}

	/**
	 * Files an issue type.
	 *
	 * The delivered body omits `value`, and the delivered write derives it from `name` — which is why
	 * the value is a column of the row and no member of the write.
	 */
	@Mutation('createIssueType')
	async createIssueType(@Args('input') input: ICreateIssueTypeInput): Promise<IssueType> {
		return (await this.issueTypeService.create(input as never)) as IssueType;
	}

	/** Changes an issue type, answering the row the write produced. */
	@Mutation('updateIssueType')
	async updateIssueType(@Args('input') input: IUpdateIssueTypeInput): Promise<IssueType> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.issueTypeService, id, values);
	}

	/** Removes an issue type outright. */
	@Mutation('deleteIssueType')
	async deleteIssueType(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.issueTypeService.delete(id);

		return true;
	}

	/** Withdraws an issue type without removing it. */
	@Mutation('softDeleteIssueType')
	async softDeleteIssueType(@Args('id', { type: () => ID }) id: Id): Promise<IssueType> {
		return (await this.issueTypeService.softRemove(id)) as IssueType;
	}

	/** Puts a withdrawn issue type back. */
	@Mutation('recoverIssueType')
	async recoverIssueType(@Args('id', { type: () => ID }) id: Id): Promise<IssueType> {
		return (await this.issueTypeService.softRecover(id)) as IssueType;
	}

	/**
	 * Makes one issue type the default of one scope, and answers every issue type of that scope back.
	 */
	@Mutation('markIssueTypeAsDefault')
	async markIssueTypeAsDefault(
		@Args('id', { type: () => ID }) id: Id,
		@Args('scope') scope: ITaskMetadataScope
	): Promise<IssueType[]> {
		return (await this.issueTypeService.markAsDefault(id, scope as never)) as IssueType[];
	}

	// ---------------------------------------------------------------------------------------------
	// The vocabulary in one answer
	// ---------------------------------------------------------------------------------------------

	/**
	 * The whole vocabulary one board needs, in one request.
	 *
	 * The same call the bootstrap route makes, with the same sections and the same default: the
	 * delivered service answers every section the caller names, or all of them when it names none.
	 * Each section is handed back as the connection its own root field answers, and each is the
	 * reader's whole answer: the connection's page is every row the reader returned, with `totalCount`
	 * stating the size the filters would select, so a client that needs more than one page walks on
	 * from the cursor rather than reading a silently truncated answer.
	 */
	@Query('taskMetadata')
	async taskMetadata(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('projectId', { type: () => ID, nullable: true }) projectId?: Id,
		@Args('include', { nullable: true }) include?: TaskMetadataSection[]
	): Promise<ITaskMetadataBootstrapResponse> {
		const answer = await this.bootstrapService.bootstrap({
			organizationId,
			organizationTeamId,
			projectId,
			include
		} as never);

		return {
			...answer,
			...(answer.taskStatuses ? { taskStatuses: this.section(answer.taskStatuses.items) } : {}),
			...(answer.taskPriorities ? { taskPriorities: this.section(answer.taskPriorities.items) } : {}),
			...(answer.taskSizes ? { taskSizes: this.section(answer.taskSizes.items) } : {}),
			...(answer.taskLabels ? { taskLabels: this.section(answer.taskLabels.items as Tag[]) } : {}),
			...(answer.taskVersions ? { taskVersions: this.section(answer.taskVersions.items) } : {}),
			...(answer.issueTypes ? { issueTypes: this.section(answer.issueTypes.items) } : {}),
			...(answer.relatedIssueTypes
				? { relatedIssueTypes: this.section(answer.relatedIssueTypes.items) }
				: {})
		} as never;
	}

	/**
	 * The scope every vocabulary read below runs in.
	 *
	 * The delivered readers take the tenant, the organization, the project and the team, build a
	 * criterion from all four, and fall back to the installation's own system rows when it selects
	 * none — that fallback is why a list may legitimately answer rows whose `tenantId` is null. The
	 * tenant and the organization are read from the credential, which is the value the routes' own
	 * clients send and the one value a caller cannot misstate; the project and the team are the two
	 * narrower choices the caller actually makes, and they are arguments because they narrow *within*
	 * the scope the credential fixes rather than choosing it.
	 */
	private scope(scope: ITaskMetadataScope): ITaskMetadataScope & { tenantId?: Id } {
		return {
			tenantId: RequestContext.currentTenantId() ?? undefined,
			organizationId: RequestContext.currentOrganizationId() ?? undefined,
			organizationTeamId: scope.organizationTeamId,
			projectId: scope.projectId
		};
	}

	/**
	 * One row of a vocabulary resource, or null when there is none.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	private async oneOrNone<T>(
		service: { findOneByIdString(id: Id, options?: unknown): Promise<T> },
		id: Id
	): Promise<T | null> {
		try {
			return await service.findOneByIdString(id);
		} catch (error) {
			if (this.isMiss(error)) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The row a write produced, read back through the same service.
	 *
	 * The delivered update answers the store's own update result — a statement about the write rather
	 * than a row — which is not what a field named `update…` may return. The row is therefore read
	 * back, through the same reader the one-row query uses, exactly as the tag surface does.
	 */
	private async writeThenRead<T>(
		service: { update(id: Id, values: unknown): Promise<unknown>; findOneByIdString(id: Id): Promise<T> },
		id: Id,
		values: unknown
	): Promise<T> {
		await service.update(id, values);

		return await service.findOneByIdString(id);
	}

	/**
	 * Whether an answer is a miss rather than a refusal.
	 *
	 * The two are different facts and the surface must not merge them: a miss is `null` on a field
	 * that may have none, and a refusal is the error the caller is owed.
	 */
	private isMiss(error: unknown): boolean {
		return (
			error instanceof Error &&
			'getStatus' in error &&
			typeof (error as { getStatus(): number }).getStatus === 'function' &&
			(error as { getStatus(): number }).getStatus() === 404
		);
	}

	/**
	 * The connection one vocabulary list root field answers with.
	 *
	 * Every one of the six shares the same implementation, the same filter-family vocabulary and the
	 * same default order, which is the whole reason they are one resolver: a connection that answered
	 * another way would be a second contract on the same endpoint.
	 */
	private connection<T>(
		rows: readonly T[] | undefined,
		filterable: Readonly<Record<string, ConnectionFieldKind>>,
		sortable: readonly string[],
		request: ConnectionRequest
	): GraphqlConnection<T> {
		return buildConnection<T>({
			rows: rows ?? [],
			filterable,
			sortable,
			defaultSort: METADATA_DEFAULT_SORT,
			request
		});
	}

	/**
	 * One section of the vocabulary answer, as a connection.
	 *
	 * The bootstrap route states no per-section narrowing, so the section's filterable vocabulary is
	 * the identifier alone — a caller cannot narrow a section here, and offering a filter that could
	 * not be honoured would be worse than offering none. The page is every row the reader answered,
	 * capped at the protocol's own ceiling, which is what keeps the one-call answer from being
	 * silently truncated at the protocol's default page size.
	 */
	private section<T>(rows: readonly T[] | undefined): GraphqlConnection<T> {
		const all = rows ?? [];

		return buildConnection<T>({
			rows: all,
			filterable: { id: 'ID' },
			sortable: ['createdAt'],
			defaultSort: METADATA_DEFAULT_SORT,
			request: { limit: Math.max(1, Math.min(all.length, API_QUERY_LIMITS.maxPageSize)) }
		});
	}
}
