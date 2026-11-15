import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IOrganizationProject,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { instantOf } from '../time-tracking/timer-reminder/timer-reminder.rules';
import { EmployeeCreateNotificationEvent } from '../employee-notification/events/employee-notification.event';
import { generateNotificationTitle } from '../employee-notification/employee-notification.helper';

/**
 * What the members of a project hear of (ever-co/ever-teams#5022): being added to it, and the changes that alter what
 * they work towards or can still do on it. Pure, so the project service and its specs read them alike.
 */

/** The fields of a project whose change its members are told of: its state and its dates. */
export const FOLLOWED_PROJECT_FIELDS = ['status', 'startDate', 'endDate'] as const;

export type FollowedProjectField = (typeof FOLLOWED_PROJECT_FIELDS)[number] | 'archived';

/** One change of a project its members are told of. */
export interface IProjectChange {
	field: FollowedProjectField;
	from: string | null;
	to: string | null;
}

/** The words of each field in a change's message. */
const FIELD_LABELS: Record<FollowedProjectField, string> = {
	status: 'Status',
	startDate: 'Start date',
	endDate: 'End date',
	archived: 'Archived'
};

/** A date as a change names it: its UTC day (projects are given days), or null for none. */
function dayOf(value: unknown): string | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	const instant = instantOf(value instanceof Date ? value : String(value));
	return Number.isFinite(instant) ? new Date(instant).toISOString().slice(0, 10) : null;
}

/** A status as a change names it: `in-progress` reads `in progress`. */
function statusOf(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim().replace(/-/g, ' ') : null;
}

/**
 * The changes of an update its members are told of: each followed field the update states with a value other than the
 * one the project held. A field the update leaves out is no change.
 *
 * @param before The project as it was before the update.
 * @param input The update's input.
 */
export function projectChangesOf(
	before: Partial<Pick<IOrganizationProject, 'status' | 'startDate' | 'endDate'>>,
	input: Partial<Record<string, unknown>>
): IProjectChange[] {
	const changes: IProjectChange[] = [];
	for (const field of FOLLOWED_PROJECT_FIELDS) {
		if (input[field] === undefined) {
			continue;
		}
		const read = field === 'status' ? statusOf : dayOf;
		const from = read(before[field]);
		const to = read(input[field]);
		if (from !== to) {
			changes.push({ field, from, to });
		}
	}
	return changes;
}

/** The change of archiving a project, or of bringing it back. */
export function projectArchiveChangeOf(wasArchived: boolean, isArchived: boolean): IProjectChange | null {
	return !!wasArchived === !!isArchived
		? null
		: { field: 'archived', from: String(!!wasArchived), to: String(!!isArchived) };
}

/**
 * The message of a change notification, in English as the platform's notification titles are:
 * `Status: in progress → completed. End date: none → 2026-12-15.`, or `The project was archived.`
 */
export function projectChangeMessageOf(changes: ReadonlyArray<IProjectChange>): string {
	return changes
		.map((change) => {
			if (change.field === 'archived') {
				return change.to === 'true' ? 'The project was archived.' : 'The project was restored.';
			}
			return `${FIELD_LABELS[change.field]}: ${change.from ?? 'none'} → ${change.to ?? 'none'}.`;
		})
		.join(' ');
}

/** The longest project name a title quotes, and the longest actor name it gives: the title column holds 255 on MySQL. */
const MAX_QUOTED_NAME_LENGTH = 120;
const MAX_ACTOR_NAME_LENGTH = 80;

/** A name shortened to `max` characters, an ellipsis at the end of one that was cut. */
export function shortenedName(name: string | null | undefined, max = MAX_QUOTED_NAME_LENGTH): string {
	const text = (name ?? '').replace(/\s+/g, ' ').trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The notifications that tell employees they were added to a project: an `Assignment` about the project, as a task's
 * new assignees are told (`Ana Assigned you to the Project "Website"`). The employee who added them is not told about
 * themselves, and an employee is told once however many times the list names them.
 *
 * @param project The project.
 * @param employeeIds The employees just added.
 * @param actor The employee who added them, and the name the title gives them.
 */
export function projectMemberAddedEvents(
	project: { id: ID; name?: string | null; organizationId: ID; tenantId: ID },
	employeeIds: ReadonlyArray<ID>,
	actor: { employeeId?: ID | null; name: string }
): EmployeeCreateNotificationEvent[] {
	const receivers = [...new Set(employeeIds.filter(Boolean).map(String))].filter(
		(employeeId) => !actor.employeeId || employeeId !== String(actor.employeeId)
	);
	const title = generateNotificationTitle(
		NotificationActionTypeEnum.Assigned,
		BaseEntityEnum.OrganizationProject,
		shortenedName(project.name),
		shortenedName(actor.name, MAX_ACTOR_NAME_LENGTH)
	);
	return receivers.map(
		(receiverEmployeeId) =>
			new EmployeeCreateNotificationEvent({
				entity: BaseEntityEnum.OrganizationProject,
				entityId: project.id,
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				title,
				receiverEmployeeId,
				...(actor.employeeId ? { sentByEmployeeId: actor.employeeId } : {}),
				organizationId: project.organizationId,
				tenantId: project.tenantId
			})
	);
}
