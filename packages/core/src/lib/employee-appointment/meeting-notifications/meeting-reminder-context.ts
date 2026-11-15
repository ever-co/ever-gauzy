import { randomUUID } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';

/** The tenant and organization a reminder is filed in: the meeting's own. */
export interface IMeetingReminderScope {
	tenantId: ID;
	organizationId: ID;
}

/**
 * The user a reminder is filed as: nobody, in the meeting's tenant and organization, with no employee (the receiver is
 * named on the notification, never taken from the context) and no permission. The tenant-aware writes stamp the tenant
 * they file under from the request context, so a reminder filed outside a request would have none.
 */
export function meetingReminderUserOf(scope: IMeetingReminderScope) {
	return {
		id: undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name: 'Meeting reminder',
		firstName: 'Meeting reminder',
		lastName: '',
		employeeId: undefined,
		permissions: [] as never[]
	};
}

/** Thrown before anything is filed when this process opens no request context of the reminder's tenant. */
export class MeetingReminderContextUnavailableError extends Error {
	constructor() {
		super('The meeting reminder cannot open a request context of its tenant in this process.');
		this.name = 'MeetingReminderContextUnavailableError';
	}
}

/**
 * Runs `fn` inside a request context of its own, in the meeting's tenant and organization, on a fresh store that holds
 * nothing of an enclosing request (as the timer reminders and the Inbox delivery file their rows). Refuses to run `fn`
 * when the context is not the tenant's: a process without the request context store would otherwise file the reminder
 * with no tenant at all.
 */
export async function runInMeetingReminderContext<T>(scope: IMeetingReminderScope, fn: () => Promise<T>): Promise<T> {
	const request = { user: meetingReminderUserOf(scope), headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			if (RequestContext.currentTenantId() !== scope.tenantId) {
				throw new MeetingReminderContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
