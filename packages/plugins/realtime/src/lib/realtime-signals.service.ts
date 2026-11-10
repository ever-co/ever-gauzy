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
import { IPresenceOutcome, IPresenceScope, RealtimePresenceStore } from './realtime-presence.store';

/** The payload of `presence.changed` (and the answer of the presence route) for a merged presence. */
function presenceOf(outcome: IPresenceOutcome, now: Date): IRealtimePresence {
	return {
		employeeId: outcome.employeeId,
		userId: outcome.userId,
		organizationId: outcome.organizationId,
		status: outcome.status,
		revision: outcome.revision,
		at: now.toISOString()
	};
}

/**
 * The ephemeral signals of the channel: presence and typing.
 *
 * A signal is published straight to the pub/sub on the tenant's topic, as a full envelope, without an
 * outbox row: nothing replays it, nothing delivers it to a webhook, and a subscriber that was not connected
 * never learns of it — which is the right fate for "Anna is typing". Presence is kept per connection and merged
 * per employee ({@link RealtimePresenceStore}); the merge is persisted on the employee (`lastSeenAt`, `isIdle`), so a
 * client that polls still sees it, and told to the organization only when it changes — on a report, or when a
 * connection lapses (a sweep every {@link REALTIME_PRESENCE_SWEEP_MS}) — and at most once per employee per
 * `REALTIME_PRESENCE_COALESCE_MS` across processes: the changes of a window are told once, as its latest state,
 * when it closes. The sweep also tells a change whose process stopped before telling it.
 */
@Injectable()
export class RealtimeSignalsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('RealtimeSignalsService');
	private sweepTimer: NodeJS.Timeout | null = null;
	private sweeping = false;
	/** The employees this process will try to tell again when their window closes, by tenant and employee. */
	private readonly later = new Map<string, NodeJS.Timeout>();
	/** Set when the module stops: nothing is claimed, published or scheduled any more. */
	private stopped = false;

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
		this.stopped = true;
		if (this.sweepTimer) clearInterval(this.sweepTimer);
		this.sweepTimer = null;
		for (const timer of this.later.values()) clearTimeout(timer);
		this.later.clear();
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
			// Each employee is told as soon as their settlement committed, whatever happens to the next one.
			await this.presenceStore.sweep(now, async (outcome) => void (await this.tellPresence(outcome, now)));
			// Then the changes no process told (it stopped inside the window) — by a process that can tell them.
			if (this.pubSub) {
				for (const scope of await this.presenceStore.untold(now)) {
					await this.announce(scope);
				}
			}
		} catch (error) {
			this.logger.warn(`The lapsed presences were not settled: ${(error as Error)?.message}`);
		} finally {
			this.sweeping = false;
		}
	}

	/** The merged presence as the payload says it; the organization is told when it changed (see {@link announce}). */
	private async tellPresence(outcome: IPresenceOutcome, now: Date): Promise<IRealtimePresence> {
		if (outcome.changed) {
			await this.announce(outcome);
		}
		return presenceOf(outcome, now);
	}

	/**
	 * Tells the organization the employee's latest presence when this process wins the window
	 * ({@link RealtimePresenceStore.claimPublication}, at the moment of the claim); otherwise tries again when the window
	 * closes. Never throws: the report that caused it is already committed, and the sweep tells what is left untold.
	 * After the module stopped it does nothing: a claim already in flight schedules nothing, and a won one is given back
	 * (`RealtimePresenceStore.release`) so another process's sweep tells it. A process without a pub/sub claims nothing
	 * either: the change stays untold, for the sweep of a process that can tell it.
	 */
	private async announce(scope: IPresenceScope): Promise<void> {
		if (this.stopped || !this.pubSub) return;
		try {
			const now = new Date();
			const publication = await this.presenceStore.claimPublication(scope, now);
			if (this.stopped) {
				if (publication.kind === 'publish') await this.presenceStore.release(publication.claim);
				return;
			}
			if (publication.kind === 'publish') {
				const outcome = publication.outcome;
				const told = await this.publish(
					REALTIME_EVENT_NAMES.PRESENCE_CHANGED,
					{ aggregate: { type: REALTIME_AGGREGATES.EMPLOYEE, id: String(outcome.employeeId) }, data: presenceOf(outcome, now) },
					{ tenantId: outcome.tenantId, organizationId: outcome.organizationId }
				);
				// The pub/sub refused it: give the claim back, so the revision is untold again and the sweep retries it.
				// (Had it been delivered before the refusal, a second delivery of the same revision is dropped by readers.)
				if (!told) await this.presenceStore.release(publication.claim);
			} else if (publication.kind === 'later') {
				this.announceAt(scope, publication.at);
			}
		} catch (error) {
			this.logger.warn(`The presence of employee ${scope.employeeId} was not told: ${(error as Error)?.message}`);
		}
	}

	/** Tries again at a moment, once per employee however many changes ask meanwhile. */
	private announceAt(scope: IPresenceScope, at: number): void {
		const key = `${scope.tenantId}|${scope.employeeId}`;
		if (this.stopped || this.later.has(key)) return;
		const timer = setTimeout(() => {
			this.later.delete(key);
			void this.announce(scope);
		}, Math.max(0, at - Date.now()));
		timer.unref?.();
		this.later.set(key, timer);
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
	 *
	 * @returns Whether the pub/sub took it (true as well where no pub/sub serves this process: nothing could take it).
	 */
	private async publish(
		name: string,
		parts: { aggregate: { type: string; id: string }; data: unknown; recipientUserIds?: ID[] },
		scope: { tenantId: ID; organizationId: ID | null }
	): Promise<boolean> {
		const { tenantId, organizationId } = scope;
		if (!this.pubSub || !tenantId) {
			return true;
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
			return true;
		} catch (error) {
			this.logger.warn(`${name} was not published: ${(error as Error)?.message}`);
			return false;
		}
	}
}
