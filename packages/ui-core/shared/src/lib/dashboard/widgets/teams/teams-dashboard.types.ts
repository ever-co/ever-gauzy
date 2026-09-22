import { ID, IEmployee } from '@gauzy/contracts';

/**
 * One task row of a team member, as rendered by the member-details widget.
 *
 * The legacy Teams dashboard derives these by grouping a member's time logs on
 * `taskId` and summing the durations, so a member who logged three sessions
 * against one task gets ONE row carrying their total.
 */
export interface ITeamDashboardMemberTask {
	/** Task id, or {@link NO_TASK_ID} for time logged without a task. */
	id: ID;

	/** Task title; empty for the {@link NO_TASK_ID} bucket, which the widget labels. */
	title: string;

	/** Seconds the member logged against this task inside the selected range. */
	duration: number;

	/** The task's own estimate in seconds, when it has one. */
	estimate?: number;
}

/**
 * Bucket key for time logged WITHOUT a task.
 *
 * The legacy page produced the same bucket implicitly (grouping on an
 * `undefined` `taskId` yields the string `"undefined"`); naming it means the
 * template can recognize it instead of testing for a missing title.
 */
export const NO_TASK_ID = '__no_task__';

/**
 * One member row of a team, as rendered by the Teams dashboard widgets.
 *
 * Flattened on purpose: the widgets render lists and counters, never the raw
 * `IOrganizationTeamEmployee` graph, and keeping the projection here means the
 * mapping rules of the legacy Teams dashboard live in exactly one place.
 */
export interface ITeamDashboardMember {
	/** Team-membership id — unique per (team, employee) pair. */
	id: ID;

	/** Employee behind the membership, when the relation resolved. */
	employeeId?: ID;

	/** Display name, already resolved from the member's user. */
	name: string;

	/** Avatar image of the member's user, when there is one. */
	imageUrl?: string;

	/** The underlying employee, forwarded to `ngx-avatar` for its profile link. */
	employee?: IEmployee;

	/** True while the member has a running timer. */
	isRunningTimer: boolean;

	/** True when the member logged any time inside the selected range. */
	isWorkingToday: boolean;

	/** Seconds the member logged inside the selected range. */
	workedDuration: number;

	/** Workable seconds in one day — the denominator of the member progress bar. */
	workPeriod: number;

	/** Activity percentage (0..100), or `null` when the daily report had none. */
	activity: number | null;

	/**
	 * What the member worked ON inside the range, one row per task.
	 *
	 * Only the member-details widget renders these; the compact widgets ignore
	 * them. Empty for a member who logged nothing.
	 */
	tasks: ITeamDashboardMemberTask[];

	/** Team the row belongs to; a member of two teams produces two rows. */
	teamId: ID;

	/** Name of {@link teamId}, so a flat member list can still be grouped. */
	teamName: string;
}

/**
 * One team of the Teams dashboard, with its members already classified.
 */
export interface ITeamDashboardTeam {
	id: ID;
	name: string;

	/** Members with a running timer. */
	countOnline: number;

	/** Members that logged time inside the selected range. */
	countWorking: number;

	/** Members that logged no time inside the selected range. */
	countNotWorking: number;

	/** Distinct members of the team. */
	countTotal: number;

	/** Working members first, then idle ones — the order the legacy page renders. */
	members: ITeamDashboardMember[];
}

/**
 * Everything the Teams dashboard widgets render, fetched once per context.
 *
 * The legacy `TeamComponent` derives all of its cards from a single pass over
 * teams + time logs + counts; this snapshot is that pass' result, so the eight
 * Teams widgets can be dropped on one canvas without multiplying the requests.
 */
export interface ITeamsDashboardSnapshot {
	/** Teams in scope, after the employee/team context filters. */
	teams: ITeamDashboardTeam[];

	/** Teams that have at least one member with a running timer. */
	teamsOnline: number;

	/** Teams that have at least one member working in the range. */
	teamsWorking: number;

	/** Teams where nobody worked in the range. */
	teamsNotWorking: number;

	/** Teams in scope — the denominator of the "Teams" counter. */
	teamsTotal: number;

	/** Distinct members that logged time in the range. */
	membersWorked: number;

	/** Distinct members across the teams in scope. */
	membersTotal: number;

	/** Distinct projects that received logged time in the range. */
	projectsWorked: number;

	/** Projects in the organization — the denominator of the projects counter. */
	projectsTotal: number;

	/** Overall activity percentage (0..100) over the selected range. */
	activityPercentage: number;
}
