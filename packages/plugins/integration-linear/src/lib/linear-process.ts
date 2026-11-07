import { randomUUID } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * The user a sync write is signed in as: the person who connected (the writes are attributed to them)
 * in the mapping's tenant and organization, with no employee (a command must not add "the current
 * employee" to what the sync creates) and no permission (the writes are the integration's, not theirs).
 */
export interface LinearSyncRequestUser {
	id: ID | undefined;
	tenantId: ID;
	lastOrganizationId: ID;
	name: string;
	firstName: string;
	lastName: string;
	employeeId: undefined;
	permissions: never[];
}

export function linearSyncUser(scope: { tenantId: ID; organizationId: ID }, userId: ID | null | undefined, name = 'Linear'): LinearSyncRequestUser {
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

/** Thrown before anything is written when this process opens no tenant-scoped request context. */
export class LinearContextUnavailableError extends Error {
	constructor() {
		super('The Linear sync cannot open a tenant-scoped request context in this process.');
		this.name = 'LinearContextUnavailableError';
	}
}

/**
 * Runs `fn` inside a request context of its own, signed in as `user`, on a fresh store that holds nothing
 * of an enclosing request (a webhook, an admin's "import now" that outlives its response): the
 * platform's task commands read the tenant, the organization and the author from that context.
 */
export async function runInLinearContext<T>(user: LinearSyncRequestUser, fn: () => Promise<T>): Promise<T> {
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			// Without the platform's request context the services would write tenant-less rows: refuse first.
			if (RequestContext.currentTenantId() !== user.tenantId) {
				throw new LinearContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
