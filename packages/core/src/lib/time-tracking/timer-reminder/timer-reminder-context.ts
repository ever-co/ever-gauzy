import { randomUUID } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';

/** The tenant and organization a reminder is filed in: the time log's own. */
export interface ITimerReminderScope {
	tenantId: ID;
	organizationId: ID;
}

/**
 * The user a reminder is filed as: nobody, in the time log's tenant and organization, with no employee (the receiver
 * is named on the notification, never taken from the context) and no permission. The tenant-aware writes stamp the
 * tenant they file under from the request context, so a reminder filed outside a request would have none.
 */
export function timerReminderUserOf(scope: ITimerReminderScope) {
	return {
		id: undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name: 'Timer reminder',
		firstName: 'Timer reminder',
		lastName: '',
		employeeId: undefined,
		permissions: [] as never[]
	};
}

/** Thrown before anything is filed when this process opens no request context of the reminder's tenant. */
export class TimerReminderContextUnavailableError extends Error {
	constructor() {
		super('The timer reminder cannot open a request context of its tenant in this process.');
		this.name = 'TimerReminderContextUnavailableError';
	}
}

/**
 * Runs `fn` inside a request context of its own, in the time log's tenant and organization, on a fresh store that holds
 * nothing of an enclosing request (the way the platform's other background writers file their rows: the Inbox delivery,
 * the integration syncs). Refuses to run `fn` when the context is not the tenant's: a process without the request
 * context store would otherwise file the reminder with no tenant at all.
 */
export async function runInTimerReminderContext<T>(scope: ITimerReminderScope, fn: () => Promise<T>): Promise<T> {
	const request = { user: timerReminderUserOf(scope), headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			if (RequestContext.currentTenantId() !== scope.tenantId) {
				throw new TimerReminderContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
