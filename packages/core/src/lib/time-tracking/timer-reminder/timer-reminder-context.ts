import { randomUUID } from 'node:crypto';
import { MikroORM, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { getORMType, MultiORMEnum } from '../../core/utils';

/** The tenant and organization a reminder is filed in: those of the record it is about (a time log, a task). */
export interface ITimerReminderScope {
	tenantId: ID;
	organizationId: ID;
}

/**
 * The user a reminder is filed as: nobody, in the record's tenant and organization, with no employee (the receiver is
 * named on the notification, never taken from the context) and no permission. The tenant-aware writes stamp the tenant
 * they file under from the request context, so a reminder filed outside a request would have none.
 *
 * @param scope The tenant and organization of the record the reminder is about.
 * @param name What the reminder is called (the timer reminder, the task due reminder).
 */
export function timerReminderUserOf(scope: ITimerReminderScope, name = 'Timer reminder') {
	return {
		id: undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name,
		firstName: name,
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
 * Runs `fn` inside a request context of its own, in the record's tenant and organization, on a fresh store that holds
 * nothing of an enclosing request (the way the platform's other background writers file their rows: the Inbox delivery,
 * the integration syncs). Refuses to run `fn` when the context is not the tenant's: a process without the request
 * context store would otherwise file the reminder with no tenant at all.
 *
 * Under DB_ORM=mikro-orm the notification is written through MikroORM, which refuses a write on its global
 * EntityManager outside a request: `fn` then also runs in a MikroORM request context of its own, on a fresh fork of
 * that EntityManager, as the API's requests, its seeding and the meeting reminders do.
 *
 * @param scope The tenant and organization of the record the reminder is about.
 * @param fn What files the reminder.
 * @param name What the reminder is called (the timer reminder, the task due reminder).
 * @param orm The MikroORM instance of this process, when it has one: under DB_ORM=mikro-orm, `fn` runs in a request
 * context of its own on it.
 */
export async function runInTimerReminderContext<T>(
	scope: ITimerReminderScope,
	fn: () => Promise<T>,
	name?: string,
	orm?: MikroORM | null
): Promise<T> {
	const request = { user: timerReminderUserOf(scope, name), headers: {}, query: {}, params: {}, body: {} };
	const inTenant = () =>
		RequestContext.runWithRequest(
			request as never,
			async () => {
				if (RequestContext.currentTenantId() !== scope.tenantId) {
					throw new TimerReminderContextUnavailableError();
				}
				return fn();
			},
			{ id: randomUUID() as ID }
		);
	if (orm && getORMType() === MultiORMEnum.MikroORM) {
		return MikroOrmRequestContext.create(orm.em, inTenant);
	}
	return inTenant();
}
