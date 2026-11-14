import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * Task automations (`@gauzy/plugin-task-automations`, spec `docs/specs/features/task-automations`): a rule of an
 * organization — optionally narrowed to a project or a team — is a trigger, conditions and actions, run in the
 * background after the change that set it off. Off unless `GAUZY_TASK_AUTOMATIONS_ENABLED=true`.
 */

/** What happened to a task (spec FR-5). */
export enum TaskAutomationTriggerEnum {
	/** A task was created. */
	TASK_CREATED = 'TASK_CREATED',
	/** A task's status changed; optionally only to, or from, given statuses. */
	STATUS_CHANGED = 'STATUS_CHANGED',
	/** Someone was added as an assignee. */
	TASK_ASSIGNED = 'TASK_ASSIGNED',
	/** Every sub-task of a task is done; the rule acts on the parent. */
	ALL_SUBTASKS_DONE = 'ALL_SUBTASKS_DONE',
	/** A done sub-task was reopened; the rule acts on the parent. */
	SUBTASK_REOPENED = 'SUBTASK_REOPENED',
	/** The due date of an open task passed (checked on a schedule). */
	DUE_DATE_PASSED = 'DUE_DATE_PASSED',
	/** A linked pull request or issue of the task closed (reported by an integration as `task_link.closed`). */
	LINK_CLOSED = 'LINK_CLOSED'
}

/** A test on the task the rule acts on (spec FR-6); all of a rule's conditions must hold. */
export enum TaskAutomationConditionEnum {
	STATUS_IS = 'STATUS_IS',
	STATUS_IS_NOT = 'STATUS_IS_NOT',
	/** The status is of one of the given workflow categories (`todo`, `in_progress`, `done`). */
	STATUS_CATEGORY_IS = 'STATUS_CATEGORY_IS',
	IS_OPEN = 'IS_OPEN',
	IS_DONE = 'IS_DONE',
	PRIORITY_IS = 'PRIORITY_IS',
	HAS_LABEL = 'HAS_LABEL',
	NOT_HAS_LABEL = 'NOT_HAS_LABEL',
	IS_ASSIGNED = 'IS_ASSIGNED',
	IS_UNASSIGNED = 'IS_UNASSIGNED',
	ASSIGNEE_IS = 'ASSIGNEE_IS',
	IS_SUBTASK = 'IS_SUBTASK',
	IS_NOT_SUBTASK = 'IS_NOT_SUBTASK',
	TITLE_CONTAINS = 'TITLE_CONTAINS'
}

/** A change to the task, or a notice to its assignees (spec FR-7). */
export enum TaskAutomationActionEnum {
	SET_STATUS = 'SET_STATUS',
	SET_PRIORITY = 'SET_PRIORITY',
	ADD_ASSIGNEES = 'ADD_ASSIGNEES',
	SET_ASSIGNEES = 'SET_ASSIGNEES',
	ADD_LABELS = 'ADD_LABELS',
	REMOVE_LABELS = 'REMOVE_LABELS',
	NOTIFY_ASSIGNEES = 'NOTIFY_ASSIGNEES'
}

/** A workflow category of statuses, for an action that should not name one status of one project. */
export enum TaskAutomationStatusCategoryEnum {
	TODO = 'todo',
	IN_PROGRESS = 'in_progress',
	DONE = 'done'
}

/** How one run of one rule for one task ended (spec FR-14). */
export enum TaskAutomationRunOutcomeEnum {
	/** The run was claimed and has not finished (a run left so by a crash is taken over after a lease). */
	RUNNING = 'RUNNING',
	/** Every action was applied (or the notice was sent). */
	APPLIED = 'APPLIED',
	/** Some actions were applied, others failed. */
	PARTIAL = 'PARTIAL',
	/** The task already had what the actions set. */
	NO_CHANGE = 'NO_CHANGE',
	/** A condition did not hold. */
	CONDITIONS_NOT_MET = 'CONDITIONS_NOT_MET',
	/** The change was made by this rule, or too many automation hops led to it. */
	LOOP_GUARD = 'LOOP_GUARD',
	/** Automations changed this task too often in the last minutes. */
	RATE_LIMITED = 'RATE_LIMITED',
	/** Nothing could be applied. */
	FAILED = 'FAILED'
}

/** A trigger and its settings. */
export interface ITaskAutomationTrigger {
	type: TaskAutomationTriggerEnum;
	/**
	 * `STATUS_CHANGED`: only when the new status is one of these (status values such as `in-progress`, or
	 * `TaskStatus` ids). Empty or absent: any status.
	 */
	toStatuses?: string[];
	/** `STATUS_CHANGED`: only when the previous status was one of these. Empty or absent: any status. */
	fromStatuses?: string[];
	/**
	 * `LINK_CLOSED`: a pull request fires only when it was merged — one closed without merging does not, and its merge
	 * after a reopen still does; an issue's close fires as without it. `false` or absent: any close, merged or not.
	 */
	mergedOnly?: boolean;
}

/** A condition and its value. */
export interface ITaskAutomationCondition {
	type: TaskAutomationConditionEnum;
	/**
	 * The values the condition compares with: statuses (values or ids) for `STATUS_IS` / `STATUS_IS_NOT`,
	 * categories for `STATUS_CATEGORY_IS`, priorities (values or ids) for `PRIORITY_IS`, tag ids for the label conditions, employee ids for
	 * `ASSIGNEE_IS`. Unused by the others.
	 */
	values?: string[];
	/** `TITLE_CONTAINS`: the text (case-insensitive). */
	text?: string;
}

/** An action and its value. */
export interface ITaskAutomationAction {
	type: TaskAutomationActionEnum;
	/** `SET_STATUS`: a status value (`done`) or a `TaskStatus` id; or, instead, `category`. */
	status?: string;
	/** `SET_STATUS`: the first status of that category of the task's project, else of its organization. */
	category?: TaskAutomationStatusCategoryEnum;
	/** `SET_PRIORITY`: a priority value (`high`) or a `TaskPriority` id. */
	priority?: string;
	/** `ADD_ASSIGNEES` / `SET_ASSIGNEES`: employee ids. */
	employeeIds?: ID[];
	/** `ADD_LABELS` / `REMOVE_LABELS`: tag ids. */
	tagIds?: ID[];
	/** `NOTIFY_ASSIGNEES`: the notice's text; a default naming the rule and the task when absent. */
	message?: string;
}

/** An automation rule (`task_automation_rule`). */
export interface ITaskAutomationRule extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description?: string | null;
	/** The rule runs only for tasks of this project. */
	projectId?: ID | null;
	/** The rule runs only for tasks of this team. */
	organizationTeamId?: ID | null;
	isEnabled: boolean;
	/** Order within the organization: rules for the same change run lowest first. */
	position: number;
	/** The template the rule was created from (display only). */
	templateKey?: string | null;
	trigger: ITaskAutomationTrigger;
	conditions: ITaskAutomationCondition[];
	actions: ITaskAutomationAction[];
	lastRunAt?: Date | null;
	createdByUserId?: ID;
}

/** What creating a rule takes; a `templateKey` fills what the body leaves out. */
export interface ITaskAutomationRuleCreateInput {
	templateKey?: string;
	name?: string;
	description?: string | null;
	projectId?: ID | null;
	organizationTeamId?: ID | null;
	isEnabled?: boolean;
	trigger?: ITaskAutomationTrigger;
	conditions?: ITaskAutomationCondition[];
	actions?: ITaskAutomationAction[];
}

/** What editing a rule takes; every field is optional. */
export type ITaskAutomationRuleUpdateInput = Omit<ITaskAutomationRuleCreateInput, 'templateKey'>;

/** `PUT /task-automations/order`: the organization's rule ids in their new order. */
export interface ITaskAutomationReorderInput {
	ids: ID[];
}

/** One change an action made (or would make). */
export interface ITaskAutomationChange {
	action: TaskAutomationActionEnum;
	field?: string;
	from?: unknown;
	to?: unknown;
	/** Why nothing changed, or why it failed. */
	note?: string;
	failed?: boolean;
}

/** One run of one rule for one task (`task_automation_run`). */
export interface ITaskAutomationRun extends IBasePerTenantAndOrganizationEntityModel {
	ruleId: ID;
	taskId?: ID | null;
	/** The delivery identity: `<eventId>:<taskId>` for a change, `due:<taskId>:<dueDate>` for the schedule. */
	eventKey: string;
	triggerType: TaskAutomationTriggerEnum;
	outcome: TaskAutomationRunOutcomeEnum;
	/** Automation hops that led to the change (0: a person's change). */
	depth: number;
	details?: { changes?: ITaskAutomationChange[]; conditions?: ITaskAutomationConditionResult[]; note?: string } | null;
	error?: string | null;
	durationMs?: number | null;
}

/** A condition's result in a run or a dry run. */
export interface ITaskAutomationConditionResult {
	type: TaskAutomationConditionEnum;
	passed: boolean;
	detail?: string;
}

/** `POST /task-automations/:id/test`. */
export interface ITaskAutomationTestInput {
	taskId: ID;
}

/** What a rule would do to a task (nothing is written). */
export interface ITaskAutomationTestResult {
	ruleId: ID;
	taskId: ID;
	/** Whether the trigger applies to this task as it is now (`null`: only an event can tell, such as a status change). */
	triggerMatches: boolean | null;
	triggerNote?: string;
	/** The task the actions would change (the parent, for the sub-task triggers). */
	subjectTaskId?: ID | null;
	conditions: ITaskAutomationConditionResult[];
	changes: ITaskAutomationChange[];
	/** What a run would record. */
	outcome: TaskAutomationRunOutcomeEnum;
}

/** A built-in starting point for a rule (spec FR-3). */
export interface ITaskAutomationTemplate {
	key: string;
	name: string;
	description: string;
	trigger: ITaskAutomationTrigger;
	conditions: ITaskAutomationCondition[];
	actions: ITaskAutomationAction[];
	/** The trigger needs an integration that reports it (`LINK_CLOSED`: the GitHub integration does). */
	requiresIntegration?: boolean;
	/** The template needs values only the organization knows (a status, a label): the editor asks for them. */
	needsInput?: boolean;
}

/** The limits a rule is held to (spec FR-2, FR-13, FR-14). */
export const TASK_AUTOMATION_LIMITS = Object.freeze({
	rulesPerOrganization: 100,
	conditionsPerRule: 10,
	actionsPerRule: 10,
	valuesPerList: 50,
	/** `TITLE_CONTAINS`: the text's most characters. */
	textLength: 200,
	nameLength: 120,
	descriptionLength: 2000,
	messageLength: 1000,
	runsShown: 50,
	runsKept: 200,
	rateLimitChanges: 20,
	rateLimitWindowMs: 10 * 60_000,
	maxDepth: 1
});

/**
 * The outbox event a task change becomes when the organization has automations (`TaskAutomationChangeCapture`), and
 * the event a closed pull request or issue linked to a task becomes (the `LINK_CLOSED` trigger): an integration reports
 * the closed link as the platform's `TaskLinkClosedEvent`, and the automations append it once per task and link (and
 * once more for a pull request merged after it was closed without merging, for the `mergedOnly` rules).
 */
export const TASK_AUTOMATION_EVENT_NAMES = Object.freeze({
	TASK_CHANGED: 'task_automation.task_changed',
	LINK_CLOSED: 'task_link.closed'
});

/** A field change carried by `task_automation.task_changed`. */
export interface ITaskAutomationFieldChange<T = string | null> {
	from: T;
	to: T;
}

/** The payload of `task_automation.task_changed` (version 1). */
export interface ITaskAutomationChangeEvent {
	taskId: ID;
	tenantId: ID;
	organizationId: ID;
	action: 'created' | 'updated';
	changes: {
		status?: ITaskAutomationFieldChange;
		taskStatusId?: ITaskAutomationFieldChange;
		membersAdded?: ID[];
		membersRemoved?: ID[];
		parentId?: ITaskAutomationFieldChange;
		priority?: ITaskAutomationFieldChange;
		taskPriorityId?: ITaskAutomationFieldChange;
		dueDate?: ITaskAutomationFieldChange;
	};
	actorUserId?: ID | null;
	/** Automation hops that led to this change (0: a person's). */
	depth: number;
	/** The rules that led to this change, oldest first. */
	chain: ID[];
}

/**
 * The payload of `task_link.closed` (aggregate `task`, id the task's), and of the platform's `TaskLinkClosedEvent` an
 * integration publishes when it sees a pull request or issue linked to a task close.
 */
export interface ITaskLinkClosedEvent {
	taskId: ID;
	tenantId: ID;
	organizationId: ID;
	/** The integration, for example `github`. */
	provider: string;
	kind: 'pull_request' | 'issue';
	url?: string | null;
	/**
	 * The provider's stable id of the pull request or issue (GitHub: its numeric id, which survives a rename or a
	 * transfer). With `provider`, `kind` and the task it is the link's identity: a link is reported once, however
	 * often its close is delivered or the item is closed again after a reopen.
	 */
	externalId?: string | null;
	/** A pull request: whether it was merged (`false`: closed without merging). Absent for an issue. */
	merged?: boolean | null;
	/**
	 * Owned by the automations: the capture sets it on `task_link.closed` from its claims and overwrites any value
	 * an integration's report carries. `true` when the link's close was handed to the rules before — the pull
	 * request was closed without merging, reopened, and is now merged — so only the rules that wait for a merge
	 * (`mergedOnly`) run on this event. `false` or absent: the link's first reported close.
	 */
	closedBefore?: boolean;
}
