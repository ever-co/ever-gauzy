import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import type { EverWorksMappingContext } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkState, EverWorksLinkType } from './entities/ever-works-sync.entities';
import type { EverWorksLinkService } from './links/ever-works-link.service';
import { runInSyncRequestContext, syncRequestUser } from './ever-works-process';

/**
 * Attribution through act-as (plan 01 §3), shared by the record handlers that write through Gauzy's
 * commands (ideas, goals, initiatives):
 *
 * - EW → G: a change is applied as the Gauzy user of its Ever Works actor (a paired person, or an
 *   agent's employee), else as the admin who connected, inside a request context of its own — so the
 *   tenant, the organization and `createdByUserId` are right.
 * - G → EW: a Gauzy change is sent as the Ever Works user its author is paired with (`X-Act-As-User`).
 */

/** The Gauzy user of an Ever Works actor: a paired person or agent employee, else the connecting admin, else `null`. */
export async function gauzyUserOfActor(
	dataSource: DataSource,
	links: EverWorksLinkService,
	context: EverWorksMappingContext,
	actor: EverWorksEventEnvelope['actor'] | null | undefined
): Promise<ID | null> {
	const type =
		actor?.type === 'user' ? EverWorksLinkType.MEMBER : actor?.type === 'agent' ? EverWorksLinkType.AGENT : null;
	if (type && actor?.id) {
		const link = await links.byEw(context.integrationTenantId, type, actor.id);
		if (link && link.state !== EverWorksLinkState.UNLINKED) {
			const employee = await dataSource
				.getRepository(Employee)
				.findOne({ where: { id: link.gauzyId, tenantId: context.tenantId } as never });
			if (employee?.userId) return employee.userId as ID;
		}
	}
	return (context.connection.connectedByUserId as ID) ?? null;
}

/** The Ever Works user a Gauzy user is paired with in the mapped organization (for `X-Act-As-User`), or `null`. */
export async function everWorksUserOfGauzyUser(
	dataSource: DataSource,
	links: EverWorksLinkService,
	context: EverWorksMappingContext,
	userId: ID | null | undefined
): Promise<string | null> {
	if (!userId) return null;
	const employee = await dataSource
		.getRepository(Employee)
		.findOne({ where: { userId, tenantId: context.tenantId, organizationId: context.organizationId } as never });
	if (!employee?.id) return null;
	const person = await links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employee.id as ID);
	return person && person.state !== EverWorksLinkState.UNLINKED ? person.ewId : null;
}

/**
 * This process cannot make the write: it cannot open a request context, or it does not host the
 * platform's write path the write dispatches to (see `ever-works-process.ts`; the worker hosts neither
 * the task, project nor employee services). Nothing was written; the event or change is deferred and
 * retried by the process that holds the connection — the sync loop runs only where these writes can
 * be made, so the retry lands in such a process.
 */
export class EverWorksNoRequestContextError extends Error {
	constructor() {
		super('This process cannot make Gauzy writes (no request context or no platform write path); the sync retries it.');
		this.name = 'EverWorksNoRequestContextError';
	}
}

/** How long a write deferred for want of a request context waits before it is tried again. */
export const NO_REQUEST_CONTEXT_RETRY_MS = 5 * 60_000;

/**
 * Runs `fn` inside a request context of its own, signed in as `userId` in the mapping's tenant and
 * organization (Gauzy's commands stamp the tenant and the author from it), in any process: where the
 * process has no context store yet (the worker), the process-wide one is attached first. No employee is
 * set, so a command never adds "the current employee" as a member of what the sync creates, and no
 * permission is held. Where no request context can be opened, or the write's platform path is not
 * hosted here, nothing is written: {@link EverWorksNoRequestContextError} is thrown.
 */
export function runAsGauzyUser<T>(
	context: EverWorksMappingContext,
	userId: ID | null,
	fn: () => Promise<T>
): Promise<T> {
	return runInSyncRequestContext(syncRequestUser(context, userId), fn, () => new EverWorksNoRequestContextError());
}
