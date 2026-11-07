import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/** The user a delivery runs as: the recipient, in their tenant and organization, with no employee and no permission. */
export interface InboxDeliveryRequestUser {
	id: ID | undefined;
	tenantId: ID;
	lastOrganizationId: ID | undefined;
	name: string;
	firstName: string;
	lastName: string;
	employeeId: undefined;
	permissions: never[];
}

export function deliveryUserOf(scope: { tenantId: ID; organizationId?: ID | null }, userId: ID | null | undefined, name = 'Inbox'): InboxDeliveryRequestUser {
	return {
		id: userId ?? undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId ?? undefined,
		name,
		firstName: name,
		lastName: '',
		employeeId: undefined,
		permissions: []
	};
}

const logger = new Logger('InboxDelivery');
/** A probe tenant no row carries: the probe only reads it back from the context it opened. */
const PROBE_TENANT = 'inbox-delivery-request-context-probe' as ID;
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
 * `AppModule` attaches the request-context store; the worker, where the sweep runs, has none, and the platform's
 * tenant-aware services (the SMTP lookup of a send) read the tenant from it. Where no store is attached, the
 * process-wide nestjs-cls store (the one the API attaches) is attached here. Cheap after the first confirmation.
 */
export function ensureRequestContextStore(): boolean {
	if (storeConfirmed) return true;
	if (opensStore()) return (storeConfirmed = true);
	const store = ClsServiceManager.getClsService();
	if (!store) return false;
	RequestContext.setClsService(store);
	storeConfirmed = opensStore();
	if (storeConfirmed) logger.log('This process had no request context store; attached the process-wide one for the deliveries.');
	return storeConfirmed;
}

/** Thrown before anything is sent when this process opens no tenant-scoped request context. */
export class InboxDeliveryContextUnavailableError extends Error {
	constructor() {
		super('The Inbox delivery cannot open a tenant-scoped request context in this process.');
		this.name = 'InboxDeliveryContextUnavailableError';
	}
}

/** Runs `fn` inside a request context of its own, signed in as `user`, on a fresh store. */
export async function runInDeliveryContext<T>(user: InboxDeliveryRequestUser, fn: () => Promise<T>): Promise<T> {
	ensureRequestContextStore();
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			if (RequestContext.currentTenantId() !== user.tenantId) {
				throw new InboxDeliveryContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
