/**
 * The lean shape of the daily activities report (`GET /timesheet/activity/report?shape=lean`).
 *
 * The full report answers every activity row with the whole employee (its user and image) and the whole project
 * attached, and repeats them on the group heads: for 200 rows that is over a megabyte, of which the clients read a
 * handful of fields, and only on the group heads (the Apps & URLs pages of Ever Teams and Gauzy, the desktop recap).
 * The lean shape keeps every number as it is (duration, duration_percentage, sessions), keeps the ids the groups are
 * built from, trims the employee and project of each group head to the fields a client shows, and drops the copies
 * the rows under a group carry. Rows outside a group (no `groupBy`) keep trimmed copies.
 */

type AnyRecord = Record<string, unknown>;

/** The fields of an employee a report client shows: the avatar, its link and its presence. */
export interface LeanReportEmployee {
	id: unknown;
	userId?: unknown;
	kind?: unknown;
	isOnline?: unknown;
	isAway?: unknown;
	fullName?: unknown;
	user?: { id: unknown; name?: unknown; firstName?: unknown; lastName?: unknown; imageUrl?: unknown } | null;
}

/** The fields of a project a report client shows. */
export interface LeanReportProject {
	id: unknown;
	name?: unknown;
	imageUrl?: unknown;
	color?: unknown;
	membersCount?: unknown;
}

const isRecord = (value: unknown): value is AnyRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

function pick<T extends AnyRecord>(source: T, keys: readonly string[]): AnyRecord {
	const out: AnyRecord = {};
	for (const key of keys) {
		if (source[key] !== undefined) out[key] = source[key];
	}
	return out;
}

export function leanReportEmployee(employee: unknown): LeanReportEmployee | unknown {
	if (!isRecord(employee)) return employee;
	const lean = pick(employee, ['id', 'userId', 'kind', 'isOnline', 'isAway', 'fullName']);
	if ('user' in employee) {
		lean.user = isRecord(employee.user) ? pick(employee.user, ['id', 'name', 'firstName', 'lastName', 'imageUrl']) : employee.user;
	}
	return lean;
}

export function leanReportProject(project: unknown): LeanReportProject | unknown {
	if (!isRecord(project)) return project;
	return pick(project, ['id', 'name', 'imageUrl', 'color', 'membersCount']);
}

/** A row under a group head: the head carries the employee and the project, the row keeps its ids and numbers. */
function leanGroupedRow(row: unknown): unknown {
	if (!isRecord(row)) return row;
	const { employee: _employee, project: _project, ...rest } = row;
	return rest;
}

function leanNode(node: unknown, underGroup: boolean): unknown {
	if (Array.isArray(node)) {
		return node.map((item) => leanNode(item, underGroup));
	}
	if (!isRecord(node)) {
		return node;
	}
	const out: AnyRecord = {};
	for (const [key, value] of Object.entries(node)) {
		if (key === 'activity' && Array.isArray(value)) {
			out[key] = value.map(leanGroupedRow);
		} else if (key === 'employee') {
			out[key] = leanReportEmployee(value);
		} else if (key === 'project') {
			out[key] = leanReportProject(value);
		} else if (key === 'employees' || key === 'projects' || key === 'dates') {
			out[key] = leanNode(value, true);
		} else {
			out[key] = value;
		}
	}
	return out;
}

/**
 * The report as the client asked for it with `shape=lean`: the same groups, dates and numbers; employees and
 * projects trimmed on the group heads and dropped from the rows under them.
 */
export function leanActivityReport<T>(report: T): T {
	return leanNode(report, false) as T;
}
