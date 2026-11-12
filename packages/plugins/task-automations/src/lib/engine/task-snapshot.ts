import { ID } from '@gauzy/contracts';

/** A status of the organization (a `task_status` row), as the engine reads it. */
export interface ITaskAutomationStatusRow {
	id: ID;
	value: string | null;
	name: string | null;
	projectId: ID | null;
	order: number | null;
	isTodo?: boolean | null;
	isInProgress?: boolean | null;
	isDone?: boolean | null;
}

/** A priority of the organization (a `task_priority` row). */
export interface ITaskAutomationPriorityRow {
	id: ID;
	value: string | null;
	name: string | null;
	projectId: ID | null;
}

/** What the engine knows of an organization while it evaluates its rules. */
export interface ITaskAutomationCatalog {
	statuses: ITaskAutomationStatusRow[];
	priorities: ITaskAutomationPriorityRow[];
	/** Employees of the organization (an assignee an action names must be one); absent: not checked. */
	employeeIds?: ReadonlySet<string>;
	/** Tags of the organization (a label an action names must be one); absent: not checked. */
	tagIds?: ReadonlySet<string>;
}

/** A status as a task carries it: the value column and the `TaskStatus` id. */
export interface ITaskAutomationStatusRef {
	status: string | null;
	taskStatusId: ID | null;
	/**
	 * The task's project: a status named by its value is the project's own row first, then the organization's, and
	 * never another project's.
	 */
	projectId?: ID | null;
}

/** A sub-task, as far as the parent triggers need it. */
export interface ITaskAutomationChildSnapshot extends ITaskAutomationStatusRef {
	id: ID;
}

/** The task a rule tests and changes, read fresh before each rule. */
export interface ITaskAutomationTaskSnapshot extends ITaskAutomationStatusRef {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	projectId: ID | null;
	teamIds: ID[];
	title: string;
	priority: string | null;
	taskPriorityId: ID | null;
	memberIds: ID[];
	tagIds: ID[];
	parentId: ID | null;
	dueDate: Date | null;
	/** Loaded for the parent triggers (and the dry run). */
	children?: ITaskAutomationChildSnapshot[];
	/** For the notices: `API-42`. */
	reference?: string | null;
}
