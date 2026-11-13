import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
	CHAT_EVENT_NAMES,
	CHAT_STREAMED_EVENTS,
	ChatEventName,
	IChatEvent,
	ID,
	IOutboxWriteInput,
	IRealtimeTypingSignal,
	JsonData,
	REALTIME_EVENT_NAMES
} from '@gauzy/contracts';
import { declareStreamedEvents, EventOutboxService, GraphqlPubSub, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';
import { CHAT_AGGREGATES } from '../chat.constants';
import { appendInTransaction } from './chat-outbox-append';
import { ChatMembershipAudience } from './chat-realtime-audience';

/** What one chat fact needs to reach the outbox. */
export interface IChatRealtimeFact {
	name: ChatEventName;
	aggregateType: string;
	aggregateId: ID;
	tenantId: ID;
	organizationId?: ID | null;
	/** The users the fact is for (the conversation's members, a thread's followers, one member). */
	recipientUserIds: readonly ID[];
	/** Content-free: ids and counters only. */
	data: Record<string, unknown>;
}

/**
 * Real time for chat: every write appends its facts to the platform outbox, addressed to the users concerned,
 * and the subscription surface delivers them (`Subscription.events` for outbox-view holders, the collaboration
 * stream of the real-time plugin for everyone). A write also answers the facts it caused ({@link IChatEvent}),
 * so the sender applies them at once and the socket only has to reach the others.
 *
 * A write appends its facts with its own transaction's manager ({@link append}), so a fact commits with the write and
 * a crash between the commit and the append cannot lose it; only the per-member fan-out of a send is appended after
 * the commit ({@link publish}). The outbox is looked up, not injected, as the Inbox does: the plugin also loads where
 * no outbox or subscription surface exists, and then a write appends nothing.
 */
@Injectable()
export class ChatRealtime implements OnModuleInit {
	private readonly logger = new Logger('ChatRealtime');

	constructor(
		private readonly dataSource: DataSource,
		private readonly moduleRef: ModuleRef
	) {}

	onModuleInit(): void {
		const catalogue = this.find(SubscriptionCatalogue);
		if (!catalogue) return;
		try {
			// Delivery (live and replayed) rechecks current membership; registered first, so the events are never
			// declared without it.
			catalogue.restrictAudience(new ChatMembershipAudience(this.dataSource).check, ...CHAT_STREAMED_EVENTS);
			declareStreamedEvents(catalogue, this.find(GraphqlSubscriptionConsumer), ...CHAT_STREAMED_EVENTS);
		} catch (error) {
			this.logger.warn(`The chat events could not be declared for subscriptions: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Appends one fact inside the write's transaction and returns it as the event the write answers. The row commits
	 * with the write or not at all: a crash after the commit cannot lose it, and a fact that cannot be stored fails the
	 * write (a lost partition race is tried again, see {@link appendInTransaction}).
	 *
	 * @param manager The manager of the write's open transaction.
	 * @param fact The fact.
	 */
	async append(manager: EntityManager, fact: IChatRealtimeFact): Promise<IChatEvent> {
		const { input, event } = this.prepare(fact);
		const outbox = this.find(EventOutboxService);
		if (outbox && input) {
			await appendInTransaction(outbox, manager, input);
		}
		return event;
	}

	/**
	 * Appends one fact after the write committed, best effort, and returns it as the event the write answers. Only for
	 * the facts a write fans out to every other member (their read and mention counters after a send): one row per
	 * member, which would hold the conversation's row lock for as long as they take to write. A lost one costs that
	 * member an instant badge update; the message's own fact, which commits with the message, still reaches them.
	 */
	async publish(fact: IChatRealtimeFact): Promise<IChatEvent> {
		const { input, event } = this.prepare(fact);
		const outbox = this.find(EventOutboxService);
		if (outbox && input) {
			try {
				await outbox.append(this.dataSource.manager, input);
			} catch (error) {
				this.logger.warn(`${fact.name} was not appended for ${fact.aggregateId}: ${(error as Error)?.message}`);
			}
		}
		return event;
	}

	/** The outbox row of a fact (none when it has no tenant, aggregate or recipient), and the event the write answers. */
	private prepare(fact: IChatRealtimeFact): { input: IOutboxWriteInput | null; event: IChatEvent } {
		const recipientUserIds = [...new Set(fact.recipientUserIds.map(String))];
		const data = { ...fact.data, recipientUserIds } as unknown as Record<string, unknown>;
		const input: IOutboxWriteInput | null =
			fact.tenantId && fact.aggregateId && recipientUserIds.length
				? {
						name: fact.name,
						aggregateType: fact.aggregateType,
						aggregateId: fact.aggregateId,
						tenantId: fact.tenantId,
						...(fact.organizationId ? { organizationId: fact.organizationId } : { tenantWide: true }),
						data
					}
				: null;
		const { recipientUserIds: _recipients, ...answered } = data;
		return { input, event: { name: fact.name, data: answered as JsonData } };
	}

	messageFact(
		name: typeof CHAT_EVENT_NAMES.MESSAGE_CREATED | typeof CHAT_EVENT_NAMES.MESSAGE_UPDATED | typeof CHAT_EVENT_NAMES.MESSAGE_DELETED,
		message: { id?: ID; conversationId: ID; threadRootId?: ID | null; authorUserId?: ID | null; kind: string; tenantId?: ID; organizationId?: ID | null },
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name,
			aggregateType: CHAT_AGGREGATES.MESSAGE,
			aggregateId: message.id as ID,
			tenantId: message.tenantId as ID,
			organizationId: message.organizationId ?? null,
			recipientUserIds,
			data: {
				conversationId: message.conversationId,
				messageId: message.id as ID,
				threadRootId: message.threadRootId ?? null,
				authorUserId: message.authorUserId ?? null,
				kind: message.kind
			}
		};
	}

	conversationFact(
		conversation: { id?: ID; tenantId?: ID; organizationId?: ID | null },
		change: 'created' | 'updated' | 'archived' | 'members' | 'removed',
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name: CHAT_EVENT_NAMES.CONVERSATION_CHANGED,
			aggregateType: CHAT_AGGREGATES.CONVERSATION,
			aggregateId: conversation.id as ID,
			tenantId: conversation.tenantId as ID,
			organizationId: conversation.organizationId ?? null,
			recipientUserIds,
			data: { conversationId: conversation.id as ID, change }
		};
	}

	memberStateFact(member: {
		conversationId: ID;
		userId: ID;
		tenantId?: ID;
		organizationId?: ID | null;
		readCount: number;
		mentionCount: number;
		notifyLevel: string;
		isFavorite: boolean;
		lastReadMessageId?: ID | null;
	}): IChatRealtimeFact {
		return {
			name: CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED,
			aggregateType: CHAT_AGGREGATES.CONVERSATION,
			aggregateId: member.conversationId,
			tenantId: member.tenantId as ID,
			organizationId: member.organizationId ?? null,
			recipientUserIds: [member.userId],
			data: {
				conversationId: member.conversationId,
				readCount: member.readCount,
				mentionCount: member.mentionCount,
				notifyLevel: member.notifyLevel,
				isFavorite: member.isFavorite,
				lastReadMessageId: member.lastReadMessageId ?? null
			}
		};
	}

	threadFact(
		root: { id?: ID; conversationId: ID; replyCount: number; tenantId?: ID; organizationId?: ID | null },
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name: CHAT_EVENT_NAMES.THREAD_CHANGED,
			aggregateType: CHAT_AGGREGATES.THREAD,
			aggregateId: root.id as ID,
			tenantId: root.tenantId as ID,
			organizationId: root.organizationId ?? null,
			recipientUserIds,
			data: { rootMessageId: root.id as ID, conversationId: root.conversationId, replyCount: root.replyCount }
		};
	}

	/**
	 * Tells the members that someone is typing: the real-time channel's `typing.signalled` signal, published straight to
	 * the subscription pub/sub as the realtime plugin publishes its own (same envelope, same aggregate), addressed to
	 * the members named. Ephemeral: no outbox row, nothing replays it, a member not connected never learns of it.
	 * Never throws.
	 *
	 * @returns Whether a pub/sub took it (false where this process serves none, or nobody is to be told).
	 */
	async signalTyping(signal: IRealtimeTypingSignal, scope: { tenantId: ID; organizationId: ID | null }, recipientUserIds: readonly ID[]): Promise<boolean> {
		const pubSub = this.find(GraphqlPubSub);
		const recipients = [...new Set(recipientUserIds.map(String))];
		if (!pubSub || !scope.tenantId || !recipients.length) return false;
		const name = REALTIME_EVENT_NAMES.TYPING_SIGNALLED;
		const envelope: SubscriptionEnvelope = {
			eventId: randomUUID(),
			name,
			tenantId: String(scope.tenantId),
			...(scope.organizationId ? { organizationId: String(scope.organizationId) } : {}),
			occurredAt: new Date(),
			// The realtime channel's own aggregate for a typing signal (`REALTIME_AGGREGATES.CONVERSATION`).
			aggregate: { type: 'conversation', id: String(signal.conversationId) },
			data: signal,
			recipientUserIds: recipients
		};
		try {
			await pubSub.publish(name, String(scope.tenantId), envelope);
			return true;
		} catch (error) {
			this.logger.warn(`${name} was not published: ${(error as Error)?.message}`);
			return false;
		}
	}

	private find<T>(token: Type<T> | undefined): T | undefined {
		if (!token) return undefined;
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
