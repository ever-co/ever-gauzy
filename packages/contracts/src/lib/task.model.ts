import { IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel, ID } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';
import { IInvoiceItem } from './invoice-item.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import {
	IOrganizationSprint,
	IRelationalOrganizationSprint,
	IOrganizationSprintTaskHistory
} from './organization-sprint.model';
import { IOrganizationTeam, IRelationalOrganizationTeam } from './organization-team.model';
import { ITaggable } from './tag.model';
import { ITaskStatus, TaskStatusEnum } from './task-status.model';
import { ITaskPriority, TaskPriorityEnum } from './task-priority.model';
import { ITaskSize, TaskSizeEnum } from './task-size.model';
import { IOrganizationProjectModule } from './organization-project-module.model';
import { IIssueType, TaskTypeEnum } from './issue-type.model';
import { IMentionEmployeeIds } from './mention.model';

export enum TaskParticipantEnum {
	EMPLOYEES = 'employees',
	TEAMS = 'teams'
}

/**
 * Which integrations may sync a task out of Gauzy.
 *
 * - `all`: every enabled integration may sync it, each by its own rules (the default; a task without a value is `all`).
 * - `ever-platform`: only the first-party Ever platform integrations (Ever Works) may sync it; third-party
 *   integrations (GitHub, Sim, …) never do. For tasks that must stay private to the Ever platform.
 * - `none`: no integration syncs it.
 */
export enum TaskSyncScopeEnum {
	ALL = 'all',
	EVER_PLATFORM = 'ever-platform',
	NONE = 'none'
}

/** Who is about to sync a task out of Gauzy: a third-party integration, or a first-party Ever platform one. */
export type TaskSyncAudience = 'third-party' | 'ever-platform';

/**
 * Whether a task's sync scope lets an integration of the given audience sync it out of Gauzy.
 *
 * A task without a scope (every task created before the column) is `all`. A value this build does not know is read
 * as the narrowest scope, `none`, so a newer scope never leaks a task through an older integration.
 */
export function isTaskSyncAllowed(
	task: { syncScope?: TaskSyncScopeEnum | string | null } | null | undefined,
	audience: TaskSyncAudience
): boolean {
	switch (task?.syncScope ?? TaskSyncScopeEnum.ALL) {
		case TaskSyncScopeEnum.ALL:
			return true;
		case TaskSyncScopeEnum.EVER_PLATFORM:
			return audience === 'ever-platform';
		default:
			return false;
	}
}

export interface IBaseTaskProperties extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	number?: number;
	public?: boolean;
	syncScope?: TaskSyncScopeEnum | null; // Which integrations may sync the task out of Gauzy (null = `all`)
	prefix?: string;
	description?: string;
	status?: TaskStatusEnum;
	priority?: TaskPriorityEnum;
	size?: TaskSizeEnum;
	issueType?: TaskTypeEnum;
	startDate?: Date;
	resolvedAt?: Date;
	dueDate?: Date;
	estimate?: number;
	isDraft?: boolean; // Define if task is still draft (E.g : Task description not completed yet)
	isScreeningTask?: boolean; // Defines if the task still in discussion before to be accepted
	version?: string;
}

// Interface for task associations (related entities)
export interface ITaskAssociations extends ITaggable, IRelationalOrganizationProject, IRelationalOrganizationSprint {
	children?: ITask[];
	members?: IEmployee[];
	invoiceItems?: IInvoiceItem[];
	teams?: IOrganizationTeam[];
	modules?: IOrganizationProjectModule[];
	taskSprints?: IOrganizationSprint[];
	taskSprintHistories?: IOrganizationSprintTaskHistory[];
}

export interface ITask extends IBaseTaskProperties, ITaskAssociations {
	parent?: ITask;
	parentId?: ID; // Optional field for specifying the parent task ID
	taskStatus?: ITaskStatus;
	taskStatusId?: ID;
	taskSize?: ITaskSize;
	taskSizeId?: ID;
	taskPriority?: ITaskPriority;
	taskPriorityId?: ID;
	taskType?: IIssueType;
	taskTypeId?: ID;
	rootEpic?: ITask;
}

export interface IGetTaskOptions extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: ID;
	isScreeningTask?: boolean;
}

export interface IGetTaskByEmployeeOptions extends IBaseRelationsEntityModel {
	where?: IGetTaskOptions;
}

export type IGetSprintsOptions = IGetTaskOptions;

export interface ITaskCreateInput extends ITask, IMentionEmployeeIds {}

export interface ITaskUpdateInput extends ITaskCreateInput {
	taskSprintMoveReason?: string;
}

export interface IGetTaskById {
	includeRootEpic?: boolean;
}

export interface IGetTasksByViewFilters extends IBasePerTenantAndOrganizationEntityModel, ITaskAdvancedFilter {
	statuses?: TaskStatusEnum[];
	priorities?: TaskPriorityEnum[];
	sizes?: TaskSizeEnum[];
	types?: TaskTypeEnum[];
	startDates?: Date[];
	dueDates?: Date[];
}

export interface ITaskDateFilterInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITask, 'isScreeningTask' | 'projectId' | 'organizationSprintId' | 'createdByUserId'>,
		IEmployeeEntityInput,
		IRelationalOrganizationTeam,
		IBaseRelationsEntityModel {
	startDateFrom?: Date;
	startDateTo?: Date;
	dueDateFrom?: Date;
	dueDateTo?: Date;
}

export interface ITaskAdvancedFilter extends IBaseRelationsEntityModel {
	ids?: ID[];
	projects?: ID[];
	teams?: ID[];
	modules?: ID[];
	sprints?: ID[];
	members?: ID[];
	tags?: ID[];
	statusIds?: ID[];
	priorityIds?: ID[];
	sizeIds?: ID[];
	parentIds?: ID[];
	createdByUserIds?: ID[];
	dailyPlans?: ID[];
	/** Task `status` values, matched against the column itself (not `taskStatusId`). */
	statuses?: TaskStatusEnum[];
	/** Task `priority` values, matched against the column itself (not `taskPriorityId`). */
	priorities?: TaskPriorityEnum[];
	/** Due on or after this instant. */
	dueDateFrom?: Date;
	/** Due on or before this instant. */
	dueDateTo?: Date;
	/** Only tasks without a due date; takes precedence over `dueDateFrom` / `dueDateTo`. */
	withoutDueDate?: boolean;
}

export interface IAdvancedTaskFiltering {
	filters?: ITaskAdvancedFilter;
}
