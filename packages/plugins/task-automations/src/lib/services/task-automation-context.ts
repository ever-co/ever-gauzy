import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ITaskAutomationActorMarker } from '../engine/loop-guard';

/**
 * The user a rule's changes are made as (spec FR-16): a system actor of the rule's tenant and organization — no user
 * id, no employee (a command must not add "the current employee" to what it writes), no permission — carrying the
 * marker that tells the change capture and the activity attribution which rule, which run and how deep.
 */
export interface ITaskAutomationRequestUser {
	id: undefined;
	tenantId: ID;
	lastOrganizationId: ID;
	name: string;
	firstName: string;
	lastName: string;
	employeeId: undefined;
	permissions: never[];
	taskAutomation: ITaskAutomationActorMarker;
}

export function automationUser(scope: { tenantId: ID; organizationId: ID }, marker: ITaskAutomationActorMarker): ITaskAutomationRequestUser {
	const name = `Automation: ${marker.ruleName}`;
	return {
		id: undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name,
		firstName: name,
		lastName: '',
		employeeId: undefined,
		permissions: [],
		taskAutomation: marker
	};
}

/** The automation marker of the request being handled, when a rule is making the change. */
export function currentAutomationMarker(): ITaskAutomationActorMarker | null {
	try {
		const user = RequestContext.currentUser() as unknown as { taskAutomation?: ITaskAutomationActorMarker } | null;
		const marker = user?.taskAutomation;
		return marker && typeof marker === 'object' && marker.ruleId ? marker : null;
	} catch {
		return null;
	}
}

const logger = new Logger('TaskAutomations');
/** A probe tenant no row carries: the probe only reads it back from the context it opened. */
const PROBE_TENANT = 'task-automations-request-context-probe' as ID;
let storeConfirmed = false;

function opensStore(): boolean {
	const probe = { user: { tenantId: PROBE_TENANT }, headers: {}, query: {}, params: {}, body: {} };
	try {
		return RequestContext.runWithRequest(probe as never, () => RequestContext.currentTenantId() === PROBE_TENANT) === true;
	} catch {
		return false;
	}
}

/**
 * Makes sure `RequestContext.runWithRequest` opens a real, tenant-scoped context in this process (the pattern of the
 * Linear sync and the Inbox delivery): a process built without the API's `AppModule` has no store attached, and the
 * platform's task commands read the tenant from it. Cheap after the first confirmation.
 */
export function ensureRequestContextStore(): boolean {
	if (storeConfirmed) return true;
	if (opensStore()) return (storeConfirmed = true);
	const store = ClsServiceManager.getClsService();
	if (!store) return false;
	RequestContext.setClsService(store);
	storeConfirmed = opensStore();
	if (storeConfirmed) logger.log('This process had no request context store; attached the process-wide one for the automation writes.');
	return storeConfirmed;
}

/** Thrown before anything is written when this process opens no tenant-scoped request context. */
export class TaskAutomationContextUnavailableError extends Error {
	constructor() {
		super('Task automations cannot open a tenant-scoped request context in this process.');
		this.name = 'TaskAutomationContextUnavailableError';
	}
}

/**
 * Runs `fn` signed in as the rule's system actor, on a fresh store that holds nothing of an enclosing request: the
 * dispatch pass that runs the rule may itself run inside the request whose commit woke it.
 */
export async function runAsAutomation<T>(user: ITaskAutomationRequestUser, fn: () => Promise<T>): Promise<T> {
	ensureRequestContextStore();
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			if (RequestContext.currentTenantId() !== user.tenantId) {
				throw new TaskAutomationContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
