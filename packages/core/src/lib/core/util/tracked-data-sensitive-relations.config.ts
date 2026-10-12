import { PermissionsEnum } from '@gauzy/contracts';
import { SensitiveRelationConfig } from '../decorators/sensitive-relations.decorator';
import { RequestContext } from '../context';

/**
 * Tracked data — time logs, time slots, screenshots and application/URL activities — belongs to one
 * employee, and the automatic per-employee restriction in `TenantAwareCrudService` only ever applies to
 * the ROOT entity of a read. A client-supplied `relations` that starts from an entity the whole
 * organization may read therefore walks straight into everybody's tracked data:
 *
 *   GET /tasks/:id?relations[]=timeLogs.timeSlots.screenshots
 *   GET /organization-team/:id?relations[]=members.employee.timeSlots.screenshots
 *
 * Both are reachable with default EMPLOYEE permissions (`ORG_TASK_VIEW`, `ORG_TEAM_VIEW`).
 *
 * This table names the hops that cross FROM such a shared entity INTO an employee's tracked data, and
 * requires the permission that already governs reading another employee's data. It is keyed by the
 * entity the relation is loaded from, so the same relation name stays free where it is harmless.
 *
 * Deliberately NOT listed: `TimeLog.timeSlots` and `TimeSlot.screenshots`. Those reads start from a row
 * that is already scoped to the caller's own employee id — the desktop timer's retry queue and the
 * screenshot modal load exactly that — so gating them would break self-service without closing
 * anything: reaching another employee's slot needs one of the hops above first.
 */
export const TRACKED_DATA_SENSITIVE_RELATIONS: Readonly<Record<string, SensitiveRelationConfig>> = {
	Employee: {
		timeSlots: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		timeLogs: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		activities: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		screenshots: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		timesheets: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	},
	Task: {
		timeLogs: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		activities: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	},
	OrganizationProject: {
		timeLogs: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		activities: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	},
	OrganizationTeam: {
		timeLogs: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		activities: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	}
};

/**
 * Relation names {@link TRACKED_DATA_SENSITIVE_RELATIONS} declares, for the cheap pre-filter that keeps
 * an ordinary request from paying for an entity-metadata walk.
 */
export const TRACKED_DATA_SENSITIVE_RELATION_NAMES: ReadonlySet<string> = new Set(
	Object.values(TRACKED_DATA_SENSITIVE_RELATIONS).flatMap((config: SensitiveRelationConfig) => Object.keys(config))
);

/**
 * Relation path segments that reach an employee's tracked data.
 */
const TRACKED_DATA_PATH_SEGMENTS: ReadonlySet<string> = new Set([
	'timeSlots',
	'screenshots',
	'activities',
	'timeLogs',
	'timesheets'
]);

/**
 * Drops the requested relations that reach tracked data, for a caller who may not act for other
 * employees.
 *
 * {@link TRACKED_DATA_SENSITIVE_RELATIONS} gates relations by the entity they are loaded from, which is
 * the right tool when the root row is shared. It cannot help where the root row itself may belong to
 * someone else — `GET /timesheet/timer/status/worked?employeeId=<teammate>` is allowed to name a
 * teammate, because the last-worked log is a team-presence feature — so those routes narrow instead.
 * Narrowing rather than refusing keeps every existing client working: the answer loses the tracked-data
 * rows, not the request.
 *
 * @param relations - The requested `relations` option.
 * @returns The relations to actually load.
 */
export function withoutTrackedDataRelations<T>(relations: T): T {
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return relations;
	}
	if (!Array.isArray(relations)) {
		// Only the string-array form reaches the routes that narrow; anything else is left to the
		// sensitive-relation walk, which runs before this.
		return relations;
	}
	return relations.filter(
		(relation: unknown) =>
			typeof relation !== 'string' ||
			!relation.split('.').some((segment: string) => TRACKED_DATA_PATH_SEGMENTS.has(segment))
	) as T;
}
