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

/**
 * The trash of an organization, a team or a project (`GET /tasks/trash`): the soft-deleted tasks, most recently
 * deleted first. A caller who may only manage teams names a team they manage.
 */
export interface ITaskTrashFindInput extends IBasePerTenantAndOrganizationEntityModel {
	organizationTeamId?: ID;
	projectId?: ID;
	/** Part of the title, or the task number. */
	search?: string;
	skip?: number;
	take?: number;
}

export interface ITaskCreateInput extends ITask, IMentionEmployeeIds {}

export interface ITaskUpdateInput extends ITaskCreateInput {
	taskSprintMoveReason?: string;
	/**
	 * When the update changes the task's project, the task's time logs follow it, except those of an approved or
	 * billed timesheet. Removing the project moves them to no project. A moved log takes the destination project's
	 * `billable` setting when that project defines one, and keeps its own otherwise. Moving them is a time edit: it
	 * needs ALLOW_MODIFY_TIME and the organization's allowModifyTime, and moves only the logs of employees the caller
	 * may act for. Opt-in: without it the logs keep the project they were tracked under.
	 */
	moveTimeLogs?: boolean;
}

export interface IGetTaskById {
	includeRootEpic?: boolean;
}

export interface IGetTasksByViewFilters extends IBasePerTenantAndOrganizationEntityModel, ITaskAdvancedFilter {
	statuses?: TaskStatusEnum[];
	priorities?: TaskPriorityEnum[];
	sizes?: TaskSizeEnum[];
	types?: TaskTypeEnum[];
	/**
	 * Starting between the earliest and the latest of these instants, both included. A view that stores the calendar
	 * days (`YYYY-MM-DD`) of those two ends in `startDateFromDay` / `startDateToDay` (the start of the first day, the
	 * last instant of the last, in the reader's zone) has a start date stored as a date only compared with those days;
	 * without them, every start date compares with the instants.
	 */
	startDates?: Date[];
	startDateFromDay?: string;
	startDateToDay?: string;
	/**
	 * Due between the earliest and the latest of these instants, both included. A view that stores the calendar days
	 * (`YYYY-MM-DD`) of those two ends in `dueDateFromDay` / `dueDateToDay` (the start of the first day, the last
	 * instant of the last, in the reader's zone) has a due date stored as a date only compared with those days, as
	 * `dueDateFrom` / `dueDateTo` are; without them, every due date compares with the instants.
	 */
	dueDates?: Date[];
}

export interface ITaskDateFilterInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITask, 'isScreeningTask' | 'projectId' | 'organizationSprintId' | 'createdByUserId'>,
		IEmployeeEntityInput,
		IRelationalOrganizationTeam,
		IBaseRelationsEntityModel {
	/** Starting on or after this instant. */
	startDateFrom?: Date;
	/** Starting on or before this instant. */
	startDateTo?: Date;
	/**
	 * The calendar days (`YYYY-MM-DD`) `startDateFrom` starts and `startDateTo` ends, in the reader's zone, sent with
	 * those instants (the start of the first day, the last instant of the last). A start date stored as a date only
	 * (midnight UTC of its day) is compared with these days rather than the instants, so it counts on its own day west
	 * of UTC too. Without them, every start date compares with the instants.
	 */
	startDateFromDay?: string;
	startDateToDay?: string;
	/** Due on or after this instant. */
	dueDateFrom?: Date;
	/** Due on or before this instant. */
	dueDateTo?: Date;
	/**
	 * The calendar days (`YYYY-MM-DD`) `dueDateFrom` starts and `dueDateTo` ends, in the reader's zone, sent with those
	 * instants (the start of the first day, the last instant of the last). A due date stored as a date only (midnight
	 * UTC of its day) is compared with these days rather than the instants, so it counts on its own day west of UTC
	 * too. Without them, every due date compares with the instants.
	 */
	dueDateFromDay?: string;
	dueDateToDay?: string;
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
	/**
	 * The calendar days (`YYYY-MM-DD`) `dueDateFrom` starts and `dueDateTo` ends, in the reader's zone, sent with those
	 * instants (the start of the first day, the last instant of the last). A due date stored as a date only (midnight
	 * UTC of its day) is compared with these days rather than the instants, so it counts on its own day west of UTC
	 * too. Without them (older callers), every due date compares with the instants.
	 */
	dueDateFromDay?: string;
	dueDateToDay?: string;
	/** Only tasks without a due date; takes precedence over `dueDateFrom` / `dueDateTo`. */
	withoutDueDate?: boolean;
}

export interface IAdvancedTaskFiltering {
	filters?: ITaskAdvancedFilter;
}

// ------------------------------------------------------------------ task views extensions (bulk update, references, built-in views)

/** The most tasks one bulk update takes. */
export const TASK_BULK_UPDATE_MAX = 100;

/**
 * What a bulk update changes on a task. Lists take `add` / `remove` (applied to the task's current list) or `set`
 * (the whole list); the previous values the platform answers use `set`, so an undo is the same request with them.
 *
 * A status, priority or size the platform does not name (a team's own) is named by its record alone (`taskStatusId`,
 * `taskPriorityId`, `taskSizeId`), which must be the task organization's, the tenant's shared one or a platform default.
 * A priority or size named by its record alone takes the record's name (its value, else its name); a status keeps its
 * text. The previous values the platform answers leave out a priority's or size's name that the record beside it
 * gives back, so an undo that sends the record alone loses nothing; a name they hold is one the record does not.
 */
export interface ITaskBulkChanges {
	status?: TaskStatusEnum | null;
	taskStatusId?: ID | null;
	priority?: TaskPriorityEnum | null;
	taskPriorityId?: ID | null;
	size?: TaskSizeEnum | null;
	taskSizeId?: ID | null;
	addTagIds?: ID[];
	removeTagIds?: ID[];
	setTagIds?: ID[];
	addMemberIds?: ID[];
	removeMemberIds?: ID[];
	setMemberIds?: ID[];
	projectId?: ID | null;
	organizationSprintId?: ID | null;
	dueDate?: Date | null;
	isArchived?: boolean;
}

export interface ITaskBulkUpdateItem {
	taskId: ID;
	changes: ITaskBulkChanges;
}

/** `POST /tasks/bulk-update`: one change for many tasks (`taskIds` + `changes`), or a change per task (`items`). */
export interface ITaskBulkUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	taskIds?: ID[];
	changes?: ITaskBulkChanges;
	items?: ITaskBulkUpdateItem[];
}

export interface ITaskBulkUpdateResult {
	taskId: ID;
	ok: boolean;
	/** Why the task was not changed (not found, not this organization's, refused by the update). */
	error?: string;
	/** The values before the change, as the changes that put them back. */
	previous?: ITaskBulkChanges;
}

export interface ITaskBulkUpdateOutcome {
	applied: number;
	refused: number;
	results: ITaskBulkUpdateResult[];
}

/** `POST /tasks/resolve-references`: `KEY-number` references to resolve, at most fifty. */
export interface ITaskReferenceResolveInput extends IBasePerTenantAndOrganizationEntityModel {
	references: string[];
}

export interface ITaskReferenceResolution {
	/** The reference as it was sent. */
	reference: string;
	key: string;
	number: number;
	resolved: boolean;
	/** More than one project answers to the key with that number: refused rather than guessed. */
	ambiguous?: boolean;
	taskId?: ID;
	projectId?: ID;
	title?: string;
	status?: TaskStatusEnum;
	/** The key the task is addressed by today (the project's current key). */
	currentKey?: string;
	/** The number the task holds today: another than `number` when it was resolved by a former reference. */
	currentNumber?: number;
	/** Resolved by a reference the task held before it moved to another project. */
	formerReference?: boolean;
}

/**
 * A reference a task held before it moved to another project (`API-42`): the project it left, and its number and
 * prefix there. Kept so the reference keeps resolving to the task, and so the number is not given to another task.
 */
export interface ITaskFormerReference extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationProject {
	task?: ITask;
	taskId: ID;
	number: number;
	prefix?: string | null;
}

/** The views the platform computes without saving: my tasks, this week, overdue, due soon. */
export enum TaskBuiltInViewEnum {
	MINE = 'mine',
	THIS_WEEK = 'this-week',
	OVERDUE = 'overdue',
	DUE_SOON = 'due-soon'
}

/** `GET /tasks/built-in/:key`: the caller's time zone (IANA) decides the day and week bounds. */
export interface ITaskBuiltInViewQuery extends IBasePerTenantAndOrganizationEntityModel {
	timeZone?: string;
	take?: number;
	skip?: number;
	/** `relations` the page carries (the same as the task list). */
	relations?: string[];
}
