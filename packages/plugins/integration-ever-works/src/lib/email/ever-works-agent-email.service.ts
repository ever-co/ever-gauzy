import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import {
	ID,
	IInboxEmailDelivered,
	IInboxEmailHandoff,
	IInboxEmailHandoffListener,
	IInboxEmailHandoffs,
	INBOX_EMAIL_HANDOFFS
} from '@gauzy/contracts';
import type { EverWorksInboundEmail, EverWorksInboundEmailResult } from '../client/ever-works-client.types';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import {
	EverWorksLinkState,
	EverWorksLinkType,
	EverWorksOutboundChange
} from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import type {
	EverWorksOutboundHandler,
	EverWorksPushContext,
	EverWorksPushOutcome
} from '../sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';

/** The mailbox setting naming the Ever Works agent a mailbox is routed to (plan 04 §2 `inbox_mailbox.settings`). */
export const EVER_WORKS_AGENT_MAILBOX_SETTING = 'everWorksAgentId';

/** The scope `POST /email/inbound` needs (opt-in: not in the "Ever Gauzy" key preset, CR-11). */
export const EVER_WORKS_EMAIL_WRITE_SCOPE = 'email:write';

/** A message the Inbox email features of this process cannot read yet waits this long (another process may). */
export const AGENT_EMAIL_WAIT_MS = 15 * 60_000;

/** How often the recovery sweep looks for delivered messages whose hand-off was never queued. */
export const AGENT_EMAIL_SWEEP_MS = 10 * 60_000;
/** How far back the sweep looks (it outlasts an outage of the process; older misses are not recovered). */
export const AGENT_EMAIL_SWEEP_WINDOW_MS = 24 * 60 * 60_000;
/** Messages one sweep reads at most per connection. */
export const AGENT_EMAIL_SWEEP_LIMIT = 500;

/** `InboundEmail` limits (`requests.schema.json`). */
const LIMITS = { address: 254, subject: 998, body: 2_000_000, list: 100, id: 255, attachments: 20, name: 255 } as const;

/** The mailbox's routing target as stated (an Ever Works agent id, or the agent employee's Gauzy id), or `null`. */
export function agentOfMailbox(settings: Record<string, unknown> | null | undefined): string | null {
	const value = settings?.[EVER_WORKS_AGENT_MAILBOX_SETTING];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The `InboundEmail` body of a stored message for an agent (the contract's limits applied), or `null` without a sender. */
export function inboundEmailBody(agentId: string, email: IInboxEmailHandoff): EverWorksInboundEmail | null {
	const address = (value: string | null | undefined) => (value ?? '').trim().slice(0, LIMITS.address);
	const from = address(email.from);
	if (from.length < 3) return null;
	const list = (values: string[]) => values.map(address).filter(Boolean).slice(0, LIMITS.list);
	const to = list(email.to);
	return {
		agentId,
		message: {
			from,
			// The mailbox's own address when the envelope named no recipient (a forward, a Bcc).
			to: to.length ? to : [address(email.mailboxAddress)],
			cc: list(email.cc),
			subject: (email.subject ?? '').slice(0, LIMITS.subject),
			text: email.text === null ? null : email.text.slice(0, LIMITS.body),
			html: email.html === null ? null : email.html.slice(0, LIMITS.body),
			messageId: email.messageId ? email.messageId.slice(0, LIMITS.id) : null,
			inReplyTo: email.inReplyTo ? email.inReplyTo.slice(0, LIMITS.id) : null,
			references: email.references.map((id) => id.slice(0, LIMITS.id)).slice(0, LIMITS.list),
			// Metadata only: Ever Works records an attachment with its url and never fetches it (CR-11); Gauzy keeps
			// the files, so no url is offered.
			attachments: email.attachments.slice(0, LIMITS.attachments).map((file) => ({
				filename: (file.filename || 'attachment').slice(0, LIMITS.name),
				contentType: (file.contentType || 'application/octet-stream').slice(0, LIMITS.name),
				url: null
			}))
		}
	};
}

/**
 * The Ever Works agent email bridge, Gauzy → Ever Works (plan 04 §6, G-P4-6; contract CR-11): a Gauzy mailbox whose
 * settings name an Ever Works agent (`settings.everWorksAgentId`: the agent's Ever Works id, or its agent employee's
 * Gauzy id) hands every message it receives to that agent — `POST /email/inbound`, where Ever Works stores it on
 * the agent's inbound address and dispatches it through the agent's inbound assignment (task-spawn or
 * conversation). The resulting Ever Works task syncs back like any task.
 *
 * - **Durable:** the Inbox's hand-off listener only enqueues an outbound change (`AGENT_EMAIL`, the message id);
 *   the pusher sends it with back-off, `Idempotency-Key` per message, and records the link (message ↔ Ever Works
 *   email), so a retry never delivers twice.
 * - **Opt-in on both sides (D9):** the Gauzy admin routes the mailbox; the key needs the opt-in `email:write`; Ever
 *   Works refuses an agent without an inbound assignment (`422 domain_rule`, a terminal refusal the sync log and
 *   the dead-letter notice show).
 * - Optional: where the Inbox email features are off, nothing registers and no change is ever queued.
 */
@Injectable()
export class EverWorksAgentEmailService
	implements EverWorksOutboundHandler, EverWorksSyncSweeper, OnModuleInit, OnModuleDestroy
{
	readonly entityTypes = [EverWorksLinkType.AGENT_EMAIL];
	readonly sweepIntervalMs = AGENT_EMAIL_SWEEP_MS;
	private readonly logger = new Logger('EverWorksAgentEmail');

	readonly listener: IInboxEmailHandoffListener = {
		id: 'ever-works-agent-email',
		delivered: (email) => this.delivered(email)
	};

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly queue: EverWorksOutboundQueue,
		private readonly log: EverWorksSyncLogService,
		@Optional() @Inject(INBOX_EMAIL_HANDOFFS) private readonly handoffs?: IInboxEmailHandoffs | null
	) {}

	onModuleInit(): void {
		if (!this.handoffs) return;
		try {
			this.handoffs.register(this.listener);
		} catch (error) {
			this.logger.warn(`The agent email hand-off was not registered (${(error as Error)?.message ?? 'error'}).`);
		}
	}

	onModuleDestroy(): void {
		this.handoffs?.unregister(this.listener.id);
	}

	/** The Inbox delivered a message: a mailbox routed to an agent queues its hand-off (nothing else is done here). */
	async delivered(email: IInboxEmailDelivered): Promise<void> {
		if (!agentOfMailbox(email.mailboxSettings) || !email.organizationId) return;
		const queued = await this.queue.enqueue({
			tenantId: email.tenantId,
			organizationId: email.organizationId,
			entityType: EverWorksLinkType.AGENT_EMAIL,
			gauzyId: email.emailId
		});
		if (!queued) this.logger.debug?.(`Inbox email ${email.emailId}: its organization has no Ever Works mapping.`);
	}

	/**
	 * The recovery sweep (every {@link AGENT_EMAIL_SWEEP_MS}, under the connection's lease): a message delivered to a
	 * routed mailbox in the last {@link AGENT_EMAIL_SWEEP_WINDOW_MS} that has neither a link nor any outbound change
	 * yet — its notice was missed (a restart between the delivery and the queue write) — is queued now.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		if (!this.handoffs) return;
		const contexts = (await this.contexts.forConnection(connection)).filter((context) => context.isEnabled);
		if (!contexts.length) return;
		const byOrganization = new Map(contexts.map((context) => [context.organizationId as ID, context]));
		const delivered = await this.handoffs.deliveredSince(
			connection.tenantId as ID,
			new Date(Date.now() - AGENT_EMAIL_SWEEP_WINDOW_MS),
			AGENT_EMAIL_SWEEP_LIMIT
		);
		const routed = delivered.filter(
			(email) =>
				agentOfMailbox(email.mailboxSettings) &&
				email.organizationId &&
				byOrganization.has(email.organizationId)
		);
		if (!routed.length) return;
		const mappings = contexts.map((context) => context.integrationTenantId as ID);
		const ids = routed.map((email) => email.emailId);
		// Anything already queued (in any state) or handed off is the pusher's: the sweep adds only what nothing covers.
		const queued = await this.dataSource.getRepository(EverWorksOutboundChange).find({
			where: {
				integrationTenantId: In(mappings),
				entityType: EverWorksLinkType.AGENT_EMAIL,
				gauzyId: In(ids)
			} as never,
			select: { gauzyId: true } as never
		});
		const covered = new Set(queued.map((row) => row.gauzyId as ID));
		for (const email of routed) {
			if (covered.has(email.emailId)) continue;
			const context = byOrganization.get(email.organizationId as ID) as EverWorksMappingContext;
			if (await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.AGENT_EMAIL, email.emailId))
				continue;
			await this.delivered(email);
		}
	}

	/** The pusher's handler: hands one stored message to the mailbox's agent. */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		if (change.op === 'delete') return { status: 'skipped', message: 'a handed-off message is not taken back' };
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id)
			return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		const emailId = change.gauzyId as ID;
		const done = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.AGENT_EMAIL, emailId);
		if (done) return { status: 'skipped', message: 'already handed to Ever Works' };
		if (!this.handoffs) {
			// The Inbox email features are not loaded in this process: a process that hosts them takes it.
			return {
				status: 'deferred',
				message: 'the Gauzy Inbox email features are not loaded in this process',
				retryInMs: AGENT_EMAIL_WAIT_MS
			};
		}
		const email = await this.handoffs.read(context.tenantId, emailId);
		if (!email) return { status: 'skipped', message: 'the message is gone, or it was not delivered' };
		const routed = agentOfMailbox(email.mailboxSettings);
		if (!routed) return { status: 'skipped', message: 'the mailbox is no longer routed to an Ever Works agent' };
		const agentId = await this.everWorksAgentOf(context, routed);
		if (!agentId) {
			return this.refused(
				context,
				change,
				`the mailbox names ${routed}, which is no Ever Works agent paired with this organization`
			);
		}
		if (!this.hasScope(context, EVER_WORKS_EMAIL_WRITE_SCOPE)) {
			return this.refused(
				context,
				change,
				`the integration key lacks ${EVER_WORKS_EMAIL_WRITE_SCOPE} (opt-in): create a key with it to route mail to agents`
			);
		}
		const body = inboundEmailBody(agentId, email);
		if (!body) return this.refused(context, change, 'the message has no sender address');

		const client = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		const result = await client.request<EverWorksInboundEmailResult>('POST', '/email/inbound', {
			body,
			// One delivery per message: a retry (or another process) replays Ever Works' first answer.
			idempotencyKey: createHash('sha256').update(`${context.connection.id}:agent-email:${emailId}`).digest('hex')
		});
		const message = result?.message;
		if (message?.id) {
			await this.links.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				entityType: EverWorksLinkType.AGENT_EMAIL,
				gauzyId: emailId,
				ewId: message.id,
				ewVersion: typeof message.version === 'number' ? message.version : null,
				ewUpdatedAt: message.updatedAt ?? null,
				snapshot: {
					agentId,
					mailboxId: email.mailboxId,
					dispatch: result.dispatch ?? null,
					taskId: message.taskId ?? null,
					conversationId: message.conversationId ?? null
				},
				direction: 'outbound'
			});
		}
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'outbound',
			entityType: EverWorksLinkType.AGENT_EMAIL,
			gauzyId: emailId,
			ewId: message?.id ?? null,
			action: 'agent_email',
			status: 'ok',
			message: `handed to Ever Works agent ${agentId} (${result?.dispatch?.mode ?? 'delivered'})`
		});
		return { status: 'pushed', message: `handed to agent ${agentId}` };
	}

	/**
	 * The Ever Works agent a mailbox names: its Ever Works id, or the Gauzy id of its agent employee — either way
	 * one paired with this organization (an `AGENT` link that is still synced).
	 */
	private async everWorksAgentOf(context: EverWorksMappingContext, routed: string): Promise<string | null> {
		const byEw = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, routed);
		if (byEw && byEw.state !== EverWorksLinkState.UNLINKED) return byEw.ewId;
		const byGauzy = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.AGENT, routed as ID);
		return byGauzy && byGauzy.state !== EverWorksLinkState.UNLINKED ? byGauzy.ewId : null;
	}

	/** Whether the connection's key holds a scope (an unreadable list counts as holding none). */
	private hasScope(context: EverWorksMappingContext, scope: string): boolean {
		try {
			const scopes = JSON.parse(context.connection.scopes || '[]');
			return Array.isArray(scopes) && scopes.includes(scope);
		} catch {
			return false;
		}
	}

	/** A hand-off that cannot happen as configured: skipped (no retry would change it) and logged for the admin. */
	private async refused(
		context: EverWorksMappingContext,
		change: EverWorksOutboundChange,
		reason: string
	): Promise<EverWorksPushOutcome> {
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'outbound',
			entityType: EverWorksLinkType.AGENT_EMAIL,
			gauzyId: change.gauzyId as ID,
			action: 'agent_email',
			status: 'skipped',
			message: reason
		});
		this.logger.warn(`Inbox email ${change.gauzyId}: not handed to Ever Works — ${reason}.`);
		return { status: 'skipped', message: reason };
	}
}
