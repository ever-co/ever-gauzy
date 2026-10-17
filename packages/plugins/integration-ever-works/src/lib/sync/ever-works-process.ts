import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandHandlerNotFoundException } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { ClsServiceManager } from 'nestjs-cls';
import { ID } from '@gauzy/contracts';
import { EmployeeService, OrganizationProjectService, RequestContext, TaskService } from '@gauzy/core';

/**
 * What a process needs for the sync's Gauzy writes (plan 03 §C.4 step 4), and the one place those writes
 * enter a request context of their own.
 *
 * The platform's services and commands read the tenant, the organization and the author
 * (`createdByUserId` / `updatedByUserId`) from the request context, which a background sync does not
 * have. Every write of the sync is therefore made inside `RequestContext.runWithRequest`, signed in as
 * the attributed user in the mapping's tenant and organization. That needs two things of the process:
 *
 * 1. **A context store.** `RequestContext` keeps its context in nestjs-cls. Core's `AppModule` attaches
 *    the store when the API boots; the worker builds its own module graph without it, so there
 *    `runWithRequest` opened nothing and every write was refused. {@link ensureRequestContextStore}
 *    attaches the same process-wide store (nestjs-cls keeps a single one per process, the instance
 *    `AppModule` attaches) where none is attached yet. Outside a `runWithRequest`, every accessor still
 *    answers as before (no tenant, no user), so code of the process that never enters one — the
 *    documents pipeline, whose jobs carry their tenant explicitly — is unchanged.
 * 2. **The platform's write paths.** Tasks are written through `TaskCreateCommand` / `TaskUpdateCommand`
 *    and the task service, projects through `OrganizationProjectCreateCommand`, agents through the
 *    employee service. Their handlers are providers of core's task, project and employee modules, which
 *    the API hosts and the worker does not (its module graph is the documents pipeline and the commerce
 *    sweeps). {@link EverWorksProcessCapability} tells whether this process hosts them; the sync loop
 *    runs only where it does, so the connection's lease can never be held by a process that would only
 *    defer the writes.
 */

/** The signed-in user of a sync write: the attributed user in the mapping's tenant and organization. */
export interface EverWorksSyncRequestUser {
	id: ID | undefined;
	tenantId: ID;
	lastOrganizationId: ID;
	name: string;
	firstName: string;
	lastName: string;
	/** Never set: a command must not add "the current employee" as a member of what the sync creates. */
	employeeId: undefined;
	/** None: the sync's writes are not authorized by a permission of the attributed user. */
	permissions: never[];
}

/** The user a sync write is signed in as (`userId` = the attributed Gauzy user; `null` = none). */
export function syncRequestUser(
	scope: { tenantId: ID; organizationId: ID },
	userId: ID | null | undefined,
	name = 'Ever Works'
): EverWorksSyncRequestUser {
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

const logger = new Logger('EverWorksSync');
/** A probe tenant no row carries: the probe only reads it back from the context it opened. */
const PROBE_TENANT = 'ever-works-request-context-probe' as ID;
let storeConfirmed = false;

/** Whether `RequestContext.runWithRequest` opens a store in this process (the probe reads its own tenant back). */
function opensStore(): boolean {
	const probe = { user: { tenantId: PROBE_TENANT }, headers: {}, query: {}, params: {}, body: {} };
	try {
		// Synchronous in the platform's `RequestContext`: anything else (a stand-in) is not a confirmed store.
		return RequestContext.runWithRequest(probe as never, () => RequestContext.currentTenantId() === PROBE_TENANT) === true;
	} catch {
		return false;
	}
}

/**
 * Makes sure `RequestContext.runWithRequest` opens a real, tenant-scoped context in this process: where
 * no context store is attached (a process built without core's `AppModule`, such as the worker), the
 * process-wide nestjs-cls store is attached — the one `AppModule` attaches in the API. Returns whether
 * a context can be opened now. Cheap after the first confirmation.
 */
export function ensureRequestContextStore(): boolean {
	if (storeConfirmed) return true;
	if (opensStore()) return (storeConfirmed = true);
	const store = ClsServiceManager.getClsService();
	const attach = (RequestContext as unknown as { setClsService?: (service: unknown) => void }).setClsService;
	if (!store || typeof attach !== 'function') return false;
	attach.call(RequestContext, store);
	storeConfirmed = opensStore();
	if (storeConfirmed) logger.log('This process had no request context store; attached the process-wide one for the sync writes.');
	return storeConfirmed;
}

/** A platform write path this process does not host (no command handler, no service): the write cannot be made here. */
export function isMissingWritePath(error: unknown): boolean {
	return (
		error instanceof CommandHandlerNotFoundException ||
		(error instanceof Error && error.constructor?.name === 'UnknownElementException')
	);
}

/**
 * Runs `fn` inside a request context of its own, signed in as `user` (see {@link syncRequestUser}), on a
 * fresh store that holds nothing of an enclosing request. `unavailable` is thrown — before anything is
 * written — where no context can be opened, and in place of a missing platform write path, so the
 * caller defers the change instead of failing it.
 */
export async function runInSyncRequestContext<T>(
	user: EverWorksSyncRequestUser,
	fn: () => Promise<T>,
	unavailable: () => Error,
	options: { id?: ID } = {}
): Promise<T> {
	ensureRequestContextStore();
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			// Without the platform's request context the services would write tenant-less rows: refuse first.
			if (RequestContext.currentTenantId() !== user.tenantId) throw unavailable();
			try {
				return await fn();
			} catch (error) {
				if (isMissingWritePath(error)) throw unavailable();
				throw error;
			}
		},
		{ id: options.id ?? (randomUUID() as ID) }
	);
}

/** The platform services the sync's Gauzy writes dispatch to; each comes with its module's command handlers. */
const WRITE_SERVICES: ReadonlyArray<readonly [string, Type<unknown>]> = [
	['TaskService', TaskService as Type<unknown>],
	['OrganizationProjectService', OrganizationProjectService as Type<unknown>],
	['EmployeeService', EmployeeService as Type<unknown>]
];

/**
 * Whether this process can make the sync's Gauzy writes: it hosts the platform's task, project and
 * employee services (and with them the command handlers the writes dispatch to). The API does; the
 * worker does not today. Decided once, after the module graph is built.
 */
@Injectable()
export class EverWorksProcessCapability {
	private missing: string[] | null = null;

	constructor(private readonly moduleRef: ModuleRef) {}

	/** The write services this process does not host (empty = it can make every sync write). */
	missingWriteServices(): string[] {
		if (!this.missing) this.missing = WRITE_SERVICES.filter(([, type]) => !this.hosts(type)).map(([name]) => name);
		return this.missing;
	}

	canWriteGauzy(): boolean {
		return this.missingWriteServices().length === 0;
	}

	private hosts(type: Type<unknown>): boolean {
		try {
			return !!this.moduleRef.get(type, { strict: false });
		} catch {
			return false;
		}
	}
}
