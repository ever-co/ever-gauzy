import { ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import {
	ID,
	IRealtimePresence,
	IRealtimePresenceInput,
	IRealtimeTypingInput,
	IRealtimeTypingSignal,
	REALTIME_EVENT_NAMES,
	RealtimePresenceStatus
} from '@gauzy/contracts';
import { Employee, GraphqlPubSub, RequestContext } from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';
import { REALTIME_AGGREGATES, REALTIME_PRESENCE_SWEEP_MS } from './realtime.constants';
import { REALTIME_SHARED_CONNECTION_KEY } from './realtime.entities';
import { IPresenceOutcome, RealtimePresenceStore } from './realtime-presence.store';

/**
 * The ephemeral signals of the channel: presence and typing.
 *
 * A signal is published straight to the pub/sub on the tenant's topic, as a full envelope, without an
 * outbox row: nothing replays it, nothing delivers it to a webhook, and a subscriber that was not connected
 * never learns of it — which is the right fate for "Anna is typing". Presence is kept per connection and merged
 * per employee ({@link RealtimePresenceStore}); the merge is persisted on the employee (`lastSeenAt`, `isIdle`), so a
 * client that polls still sees it, and told to the organization only when it changes — on a report, or when a
 * connection lapses (a sweep every {@link REALTIME_PRESENCE_SWEEP_MS}).
 */
@Injectable()
export class RealtimeSignalsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('RealtimeSignalsService');
	private sweepTimer: NodeJS.Timeout | null = null;
	private sweeping = false;

	constructor(
		private readonly dataSource: DataSource,
		private readonly presenceStore: RealtimePresenceStore,
		@Optional() private readonly pubSub?: GraphqlPubSub
	) {}

	onModuleInit(): void {
		this.sweepTimer = setInterval(() => void this.sweepPresence(), REALTIME_PRESENCE_SWEEP_MS);
		this.sweepTimer.unref?.();
	}

	onModuleDestroy(): void {
		if (this.sweepTimer) clearInterval(this.sweepTimer);
		this.sweepTimer = null;
	}

	/**
	 * Records what the caller's connection reports, merges it with the employee's other connections, and tells the
	 * organization when the employee's presence changed.
	 *
	 * @param input The status the connection reports, and the connection's id (none: the employee's shared one).
	 * @returns The employee's presence as now merged.
	 * @throws ForbiddenException when the caller has no employee record.
	 */
	async publishPresence(input: IRealtimePresenceInput): Promise<IRealtimePresence> {
		const employeeId = RequestContext.currentUser()?.employeeId;
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		if (!employeeId || !userId || !tenantId) {
			throw new ForbiddenException('Only an employee can report presence.');
		}

		const now = new Date();
		const outcome = await this.presenceStore.report({
			tenantId,
			organizationId: RequestContext.currentOrganizationId() ?? null,
			employeeId,
			userId,
			connectionId: input.connectionId || REALTIME_SHARED_CONNECTION_KEY,
			status: input.status ?? RealtimePresenceStatus.ACTIVE,
			now
		});
		return this.tellPresence(outcome, now);
	}

	/**
	 * Settles the connections that lapsed (no report within the TTL) and tells the organization of each employee whose
	 * presence changed. One pass at a time per process; a failed pass is logged and the next one tries again.
	 */
	async sweepPresence(now: Date = new Date()): Promise<void> {
		if (this.sweeping) return;
		this.sweeping = true;
		try {
			for (const outcome of await this.presenceStore.sweep(now)) {
				await this.tellPresence(outcome, now);
			}
		} catch (error) {
			this.logger.warn(`The lapsed presences were not settled: ${(error as Error)?.message}`);
		} finally {
			this.sweeping = false;
		}
	}

	/** The merged presence as the payload says it, published to the organization when it changed. */
	private async tellPresence(outcome: IPresenceOutcome, now: Date): Promise<IRealtimePresence> {
		const presence: IRealtimePresence = {
			employeeId: outcome.employeeId,
			userId: outcome.userId,
			organizationId: outcome.organizationId,
			status: outcome.status,
			at: now.toISOString()
		};
		if (outcome.changed) {
			await this.publish(
				REALTIME_EVENT_NAMES.PRESENCE_CHANGED,
				{ aggregate: { type: REALTIME_AGGREGATES.EMPLOYEE, id: String(outcome.employeeId) }, data: presence },
				{ tenantId: outcome.tenantId, organizationId: outcome.organizationId }
			);
		}
		return presence;
	}

	/**
	 * Tells the named users that the caller is typing.
	 *
	 * The recipients are what the caller names, narrowed to the users who are employees of the caller's tenant
	 * (and organization, when the request is scoped to one): a signal never leaves that circle, whatever ids a
	 * client sends. Whether those users are members of the conversation is the conversation's own rule — the
	 * chat plugin's clients name a conversation's members, read through the chat API, which only answers members.
	 *
	 * @param input Where, and whom to tell.
	 * @returns The signal as published.
	 */
	async publishTyping(input: IRealtimeTypingInput): Promise<IRealtimeTypingSignal> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		if (!userId || !tenantId) {
			throw new ForbiddenException('Only a signed-in user can signal typing.');
		}

		const signal: IRealtimeTypingSignal = {
			conversationId: input.conversationId,
			threadRootId: input.threadRootId ?? null,
			employeeId: RequestContext.currentUser()?.employeeId ?? null,
			userId,
			at: new Date().toISOString()
		};

		// Addressed: the recipients are the members the caller named, never the caller, and only colleagues.
		const named = [...new Set((input.recipientUserIds ?? []).map(String))].filter((id) => id !== String(userId));
		const recipientUserIds = named.length ? await this.colleagues(named, tenantId) : [];

		await this.publish(
			REALTIME_EVENT_NAMES.TYPING_SIGNALLED,
			{ aggregate: { type: REALTIME_AGGREGATES.CONVERSATION, id: String(input.conversationId) }, data: signal, recipientUserIds },
			{ tenantId, organizationId: RequestContext.currentOrganizationId() ?? null }
		);

		return signal;
	}

	/** The named users who are active employees of the caller's tenant (and organization, when scoped to one). */
	private async colleagues(userIds: string[], tenantId: ID): Promise<ID[]> {
		const organizationId = RequestContext.currentOrganizationId();
		const employees = await this.dataSource.getRepository(Employee).find({
			select: { id: true, userId: true },
			where: {
				userId: In(userIds),
				tenantId,
				...(organizationId ? { organizationId } : {}),
				isActive: true,
				isArchived: false
			}
		});
		return [...new Set(employees.map((employee) => String(employee.userId)))] as ID[];
	}

	/**
	 * Publishes one envelope on a tenant's topic, for an organization (or tenant-wide). Never throws: a signal that
	 * cannot be published is logged, the request that carried it still succeeds.
	 */
	private async publish(
		name: string,
		parts: { aggregate: { type: string; id: string }; data: unknown; recipientUserIds?: ID[] },
		scope: { tenantId: ID; organizationId: ID | null }
	): Promise<void> {
		const { tenantId, organizationId } = scope;
		if (!this.pubSub || !tenantId) {
			return;
		}
		const envelope: SubscriptionEnvelope = {
			eventId: randomUUID(),
			name,
			tenantId: String(tenantId),
			...(organizationId ? { organizationId: String(organizationId) } : {}),
			occurredAt: new Date(),
			aggregate: parts.aggregate,
			data: parts.data,
			...(parts.recipientUserIds ? { recipientUserIds: parts.recipientUserIds.map(String) } : {})
		};
		try {
			await this.pubSub.publish(name, String(tenantId), envelope);
		} catch (error) {
			this.logger.warn(`${name} was not published: ${(error as Error)?.message}`);
		}
	}
}
