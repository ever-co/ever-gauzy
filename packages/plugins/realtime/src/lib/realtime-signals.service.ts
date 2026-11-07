import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
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
import { Employee, EmployeeService, GraphqlPubSub, RequestContext } from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';
import { REALTIME_AGGREGATES } from './realtime.constants';

/**
 * The ephemeral signals of the channel: presence and typing.
 *
 * A signal is published straight to the pub/sub on the tenant's topic, as a full envelope, without an
 * outbox row: nothing replays it, nothing delivers it to a webhook, and a subscriber that was not connected
 * never learns of it — which is the right fate for "Anna is typing". Presence is also persisted on the
 * employee (`lastSeenAt`, `isIdle`) through the existing heartbeat, so a client that polls still sees it.
 */
@Injectable()
export class RealtimeSignalsService {
	private readonly logger = new Logger('RealtimeSignalsService');

	constructor(
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		@Optional() private readonly pubSub?: GraphqlPubSub
	) {}

	/**
	 * Records the caller's presence on their employee and tells the organization.
	 *
	 * @param input The status the client reports.
	 * @returns The presence as published.
	 * @throws ForbiddenException when the caller has no employee record.
	 */
	async publishPresence(input: IRealtimePresenceInput): Promise<IRealtimePresence> {
		const employeeId = RequestContext.currentUser()?.employeeId;
		const userId = RequestContext.currentUserId();
		if (!employeeId || !userId) {
			throw new ForbiddenException('Only an employee can report presence.');
		}

		const status = input.status ?? RealtimePresenceStatus.ACTIVE;
		// The existing heartbeat: `lastSeenAt` now, `isIdle` for anything but active input.
		await this.employeeService.updatePresence({ isIdle: status !== RealtimePresenceStatus.ACTIVE });

		const presence: IRealtimePresence = {
			employeeId,
			userId,
			organizationId: RequestContext.currentOrganizationId() ?? null,
			status,
			at: new Date().toISOString()
		};

		await this.publish(REALTIME_EVENT_NAMES.PRESENCE_CHANGED, {
			aggregate: { type: REALTIME_AGGREGATES.EMPLOYEE, id: String(employeeId) },
			data: presence
		});

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

		await this.publish(REALTIME_EVENT_NAMES.TYPING_SIGNALLED, {
			aggregate: { type: REALTIME_AGGREGATES.CONVERSATION, id: String(input.conversationId) },
			data: signal,
			recipientUserIds
		});

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
	 * Publishes one envelope on the caller's tenant topic. Never throws: a signal that cannot be published is
	 * logged, the request that carried it still succeeds.
	 */
	private async publish(
		name: string,
		parts: { aggregate: { type: string; id: string }; data: unknown; recipientUserIds?: ID[] }
	): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		if (!this.pubSub || !tenantId) {
			return;
		}
		const organizationId = RequestContext.currentOrganizationId();
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
