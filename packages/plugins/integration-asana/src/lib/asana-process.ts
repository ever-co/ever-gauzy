import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * The user a sync write is signed in as: the person who connected (the writes are attributed to them)
 * in the mapping's tenant and organization, with no employee (a command must not add "the current
 * employee" to what the sync creates) and no permission (the writes are the integration's, not theirs).
 */
export interface AsanaSyncRequestUser {
	id: ID | undefined;
	tenantId: ID;
	lastOrganizationId: ID;
	name: string;
	firstName: string;
	lastName: string;
	employeeId: undefined;
	permissions: never[];
}

export function asanaSyncUser(scope: { tenantId: ID; organizationId: ID }, userId: ID | null | undefined, name = 'Asana'): AsanaSyncRequestUser {
	return {
		id: userId ?? undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name,
		firstName: name,
		lastName: '',
		employeeId: undefined,
		permissions: []
	};
}

const logger = new Logger('AsanaSync');
/** A probe tenant no row carries: the probe only reads it back from the context it opened. */
const PROBE_TENANT = 'integration-asana-request-context-probe' as ID;
let storeConfirmed = false;

/** Whether `RequestContext.runWithRequest` opens a store in this process (the probe reads its own tenant back). */
function opensStore(): boolean {
	const probe = { user: { tenantId: PROBE_TENANT }, headers: {}, query: {}, params: {}, body: {} };
	try {
		return RequestContext.runWithRequest(probe as never, () => RequestContext.currentTenantId() === PROBE_TENANT) === true;
	} catch {
		return false;
	}
}

/**
 * Makes sure `RequestContext.runWithRequest` opens a real, tenant-scoped context in this process. The API's
 * `AppModule` attaches the request-context store; a process built without it — the worker, where the scheduled
 * import runs — has none, and `runWithRequest` would run the work with no context at all, which {@link
 * runInAsanaContext} refuses. Where no store is attached, the process-wide nestjs-cls store (the one the API
 * attaches) is attached here. Returns whether a context can be opened now; cheap after the first confirmation.
 */
export function ensureRequestContextStore(): boolean {
	if (storeConfirmed) return true;
	if (opensStore()) return (storeConfirmed = true);
	const store = ClsServiceManager.getClsService();
	if (!store) return false;
	RequestContext.setClsService(store);
	storeConfirmed = opensStore();
	if (storeConfirmed) logger.log('This process had no request context store; attached the process-wide one for the sync writes.');
	return storeConfirmed;
}

/** Thrown before anything is written when this process opens no tenant-scoped request context. */
export class AsanaContextUnavailableError extends Error {
	constructor() {
		super('The Asana sync cannot open a tenant-scoped request context in this process.');
		this.name = 'AsanaContextUnavailableError';
	}
}

/**
 * Runs `fn` inside a request context of its own, signed in as `user`, on a fresh store that holds nothing
 * of an enclosing request (a webhook, an admin's "import now" that outlives its response): the
 * platform's task commands read the tenant, the organization and the author from that context.
 */
export async function runInAsanaContext<T>(user: AsanaSyncRequestUser, fn: () => Promise<T>): Promise<T> {
	ensureRequestContextStore();
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			// Without the platform's request context the services would write tenant-less rows: refuse first.
			if (RequestContext.currentTenantId() !== user.tenantId) {
				throw new AsanaContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
