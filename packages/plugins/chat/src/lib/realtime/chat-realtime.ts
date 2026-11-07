import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { CHAT_EVENT_NAMES, CHAT_STREAMED_EVENTS, ChatEventName, IChatEvent, ID, JsonData } from '@gauzy/contracts';
import { declareStreamedEvents, EventOutboxService, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';
import { CHAT_AGGREGATES } from '../chat.constants';

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
 * Looked up, not injected, as the Inbox does: the plugin also loads where no subscription surface exists. Nothing
 * here fails a write; a lost fact costs an instant update, never the message.
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
			declareStreamedEvents(catalogue, this.find(GraphqlSubscriptionConsumer), ...CHAT_STREAMED_EVENTS);
		} catch (error) {
			this.logger.warn(`The chat events could not be declared for subscriptions: ${(error as Error)?.message}`);
		}
	}

	/** Appends one fact (best effort) and returns it as the event the write answers. */
	async publish(fact: IChatRealtimeFact): Promise<IChatEvent> {
		const recipientUserIds = [...new Set(fact.recipientUserIds.map(String))];
		const data = { ...fact.data, recipientUserIds } as unknown as Record<string, unknown>;
		const outbox = this.find(EventOutboxService);
		if (outbox && fact.tenantId && fact.aggregateId && recipientUserIds.length) {
			try {
				await outbox.append(this.dataSource.manager, {
					name: fact.name,
					aggregateType: fact.aggregateType,
					aggregateId: fact.aggregateId,
					tenantId: fact.tenantId,
					...(fact.organizationId ? { organizationId: fact.organizationId } : { tenantWide: true }),
					data
				});
			} catch (error) {
				this.logger.warn(`${fact.name} was not appended for ${fact.aggregateId}: ${(error as Error)?.message}`);
			}
		}
		const { recipientUserIds: _recipients, ...answered } = data;
		return { name: fact.name, data: answered as JsonData };
	}

	messageFact(
		name: typeof CHAT_EVENT_NAMES.MESSAGE_CREATED | typeof CHAT_EVENT_NAMES.MESSAGE_UPDATED | typeof CHAT_EVENT_NAMES.MESSAGE_DELETED,
		message: { id: ID; conversationId: ID; threadRootId?: ID | null; authorUserId?: ID | null; kind: string; tenantId?: ID; organizationId?: ID | null },
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name,
			aggregateType: CHAT_AGGREGATES.MESSAGE,
			aggregateId: message.id,
			tenantId: message.tenantId as ID,
			organizationId: message.organizationId ?? null,
			recipientUserIds,
			data: {
				conversationId: message.conversationId,
				messageId: message.id,
				threadRootId: message.threadRootId ?? null,
				authorUserId: message.authorUserId ?? null,
				kind: message.kind
			}
		};
	}

	conversationFact(
		conversation: { id: ID; tenantId?: ID; organizationId?: ID | null },
		change: 'created' | 'updated' | 'archived' | 'members' | 'removed',
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name: CHAT_EVENT_NAMES.CONVERSATION_CHANGED,
			aggregateType: CHAT_AGGREGATES.CONVERSATION,
			aggregateId: conversation.id,
			tenantId: conversation.tenantId as ID,
			organizationId: conversation.organizationId ?? null,
			recipientUserIds,
			data: { conversationId: conversation.id, change }
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
		root: { id: ID; conversationId: ID; replyCount: number; tenantId?: ID; organizationId?: ID | null },
		recipientUserIds: readonly ID[]
	): IChatRealtimeFact {
		return {
			name: CHAT_EVENT_NAMES.THREAD_CHANGED,
			aggregateType: CHAT_AGGREGATES.THREAD,
			aggregateId: root.id,
			tenantId: root.tenantId as ID,
			organizationId: root.organizationId ?? null,
			recipientUserIds,
			data: { rootMessageId: root.id, conversationId: root.conversationId, replyCount: root.replyCount }
		};
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
