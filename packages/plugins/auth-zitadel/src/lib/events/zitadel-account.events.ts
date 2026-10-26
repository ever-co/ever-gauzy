import { randomUUID } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { ZitadelLinkMethod } from '../entities/zitadel-account.entity';

/** What a link event carries: ids and the tenant display name only, never an e-mail address. */
export interface ZitadelAccountEventPayload {
	userId: ID;
	tenantId: ID | null;
	tenantName: string;
	issuer: string;
	subject: string;
	linkMethod?: ZitadelLinkMethod;
	everPersonId?: string;
}

abstract class ZitadelAccountEvent {
	readonly id: ID = randomUUID();
	readonly createdAt: Date = new Date();

	constructor(public readonly payload: ZitadelAccountEventPayload) {}
}

/**
 * Published on the core event bus after an Ever ID was linked to a Gauzy user. Nothing in this
 * plugin subscribes to it, so on its own it never leaves the process.
 */
export class ZitadelAccountLinkedEvent extends ZitadelAccountEvent {}

/** Published on the core event bus after a link was removed. */
export class ZitadelAccountUnlinkedEvent extends ZitadelAccountEvent {}
