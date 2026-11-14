import { IBasePerTenantAndOrganizationEntityModel, JsonData, ID } from './base-entity.model';
import { ITask } from './task.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationProjectModule } from './organization-project-module.model';
import { IRelationalOrganizationSprint } from './organization-sprint.model';

/** Who sees a saved view: its creator only, or everyone the view's scope (team, project, organization) reaches. */
export enum TaskViewVisibilityEnum {
	PERSONAL = 'personal',
	SHARED = 'shared'
}

export interface ITaskViewBase
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IRelationalOrganizationProject,
		IRelationalOrganizationProjectModule,
		IRelationalOrganizationSprint {
	name?: string;
	description?: string;
	visibilityLevel?: VisibilityLevelEnum;
	queryParams?: JsonData;
	filterOptions?: JsonData;
	displayOptions?: JsonData;
	properties?: Record<string, boolean>;
	isLocked?: boolean;
	/** Personal views are listed to their creator only; absent means shared. */
	visibility?: TaskViewVisibilityEnum;
	/** Bumped by every save; an update may state the version it read (`expectedVersion`) and is refused when stale. */
	version?: number;
	/** The task ids in the order the view shows them when its ordering is manual. */
	manualOrder?: ID[];
}

export interface ITaskView extends ITaskViewBase {
	name: string; // Ensure name is always defined
}

export interface ITaskViewCreateInput extends ITaskViewBase {}

export interface ITaskViewUpdateInput extends ITaskViewCreateInput {
	/** The version the client read; the update is refused (409) when the view moved on since. */
	expectedVersion?: number;
}

/** `PUT /task-views/:id/order`: the tasks in the order the view shows them. */
export interface ITaskViewOrderInput extends IBasePerTenantAndOrganizationEntityModel {
	taskIds: ID[];
	expectedVersion?: number;
}

// ------------------------------------------------------------------ the filter tree (FR-1 / FR-3), shared with the clients

/** What a view filters on. */
export type TaskViewFilterField =
	| 'status'
	| 'priority'
	| 'size'
	| 'labels'
	| 'assignees'
	| 'project'
	| 'team'
	| 'sprint'
	| 'dueDate'
	| 'createdAt'
	| 'updatedAt';

/**
 * How a condition reads its field: `in` / `notIn` / `isEmpty` / `isNotEmpty` on a record field (ids in `values`);
 * `before` (`to`), `after` (`from`), `between` (`from`, `to`), `relative` or the empties on a date field.
 */
export type TaskViewFilterOperator = 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty' | 'before' | 'after' | 'between' | 'relative';

export type TaskViewRelativeUnit = 'day' | 'week' | 'month';

/** A date window relative to now, in the caller's time zone: this week, the past 7 days, the next 2 months. */
export interface ITaskViewRelativeDate {
	unit: TaskViewRelativeUnit;
	/** How many units (ignored for `current`). */
	amount?: number;
	direction: 'current' | 'past' | 'future';
}

export interface ITaskViewFilterCondition {
	field: TaskViewFilterField;
	operator: TaskViewFilterOperator;
	/** The ids a record field is compared with. */
	values?: ID[];
	/** ISO instants for `after` / `between` and `before` / `between`. */
	from?: string;
	to?: string;
	/**
	 * The calendar day (`YYYY-MM-DD`) a person picked for `from` / `to`, sent with the instant the editor made of it: the
	 * start of that day in their zone (`after`, `before`, the lower bound of `between`), or its last instant (the upper
	 * bound of `between`). A due date stored as a date only (midnight UTC of its day) is compared with this day rather
	 * than the instant, so it falls on its own day for a reader in any zone. Without it (views saved before it came, a
	 * caller that sends instants), both kinds of value compare with the instant.
	 */
	fromDay?: string;
	toDay?: string;
	relative?: ITaskViewRelativeDate;
}

/** A group of conditions (or groups) joined by `and` / `or`. */
export interface ITaskViewFilterGroup {
	op: 'and' | 'or';
	conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup>;
}

export type TaskViewGroupBy = 'none' | 'status' | 'priority' | 'size' | 'project' | 'sprint' | 'assignee' | 'team' | 'label';

export type TaskViewOrderField = 'createdAt' | 'updatedAt' | 'dueDate' | 'title' | 'manual';

export interface ITaskViewOrdering {
	field: TaskViewOrderField;
	direction?: 'asc' | 'desc';
}

/** What `filterOptions` of a saved view holds (the clients write it, the tasks route reads it). */
export interface ITaskViewFilterOptions {
	filter?: ITaskViewFilterGroup | null;
	groupBy?: TaskViewGroupBy | null;
	orderBy?: ITaskViewOrdering | null;
}

/** `GET /task-views/:id/tasks`: the page, the grouping, the caller's time zone, and an override of the view's filter. */
export interface ITaskViewTasksQuery extends IBasePerTenantAndOrganizationEntityModel {
	/** IANA time zone the relative dates are resolved in (default UTC). */
	timeZone?: string;
	/** The cursor the previous page answered. */
	cursor?: string;
	limit?: number;
	groupBy?: TaskViewGroupBy;
	/** `relations` the page carries (the same allowlist as the built-in views). */
	relations?: string[];
	/** A filter instead of the view's (an unsaved edit of it). */
	filter?: ITaskViewFilterGroup;
}

/** One group of a view's tasks: the key (an id, or null for tasks without one), its name when known, and how many. */
export interface ITaskViewGroupCount {
	key: ID | null;
	label: string | null;
	count: number;
}

/** A condition the platform could not apply: where it is in the tree, and why. */
export interface ITaskViewInvalidFilter {
	/** The condition's place in the tree (`conditions.0.conditions.2`). */
	path: string;
	field?: string;
	reason: 'unknown-field' | 'unknown-operator' | 'malformed' | 'deleted-reference';
	/** For `deleted-reference`: the ids that no longer exist (the condition was applied without them). */
	values?: ID[];
}

export interface ITaskViewTasksPage {
	items: ITask[];
	/** The cursor of the next page, or null on the last one. */
	nextCursor: string | null;
	total: number;
	/** The counts per group when a grouping was asked for (the view's, or the query's). */
	groups: ITaskViewGroupCount[] | null;
	groupBy: TaskViewGroupBy;
	invalidFilters: ITaskViewInvalidFilter[];
}

export enum VisibilityLevelEnum {
	MODULE_AND_SPRINT = 0,
	TEAM_AND_PROJECT = 1,
	ORGANIZATION = 2,
	WORKSPACE = 3
}
