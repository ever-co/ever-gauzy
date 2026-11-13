import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Brackets, DataSource, In } from 'typeorm';
import {
	ActorTypeEnum,
	BaseEntityEnum,
	ChatConversationKindEnum,
	ChatNotifyLevelEnum,
	EmployeeNotificationTypeEnum,
	ID
} from '@gauzy/contracts';
import { EmployeeCreateNotificationEvent, EmployeeNotification, MentionService, RequestContext } from '@gauzy/core';
import { messageExcerpt } from '../chat-mentions';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';

/** The display name of the signed-in user, for a notification title. */
export function authorDisplayName(user: { firstName?: string; lastName?: string; name?: string; email?: string } | null | undefined): string {
	if (!user) return 'Someone';
	const parts = [user.firstName, user.lastName].filter((part) => typeof part === 'string' && part.trim().length > 0);
	return parts.length ? parts.join(' ') : user.name || user.email || 'Someone';
}

/** What a direct message, a group message or a thread reply reads as in the inbox. */
export function messageNotificationTitle(
	authorName: string,
	conversation: Pick<ChatConversation, 'kind' | 'name'>,
	message: Pick<ChatMessage, 'body' | 'threadRootId'> & Partial<Pick<ChatMessage, 'attachmentNames'>>
): string {
	// A message of files only reads as its files' names.
	const excerpt = messageExcerpt(message, 80);
	if (message.threadRootId) {
		return `${authorName} replied in a thread you follow${conversation.name ? ` in #${conversation.name}` : ''}: ${excerpt}`;
	}
	if (conversation.kind === ChatConversationKindEnum.DIRECT) {
		return `${authorName} sent you a message: ${excerpt}`;
	}
	return `${authorName} wrote in your group${conversation.name ? ` ${conversation.name}` : ''}: ${excerpt}`;
}

/**
 * What a message tells the platform's notification system, which files it in the Inbox:
 *
 * - an `@employee` mention → the mention service (a MENTION notification, the record to follow being the
 *   conversation);
 * - a direct or group message → a MESSAGE notification for each other member whose notify level allows it;
 * - a reply in a followed thread → a MESSAGE notification for each follower except the author.
 *
 * Reading a conversation marks the chat notifications of that conversation read through the notification
 * service, so the bell and the inbox agree. Best effort throughout: a notification is never a reason to fail a send.
 */
@Injectable()
export class ChatNotifierService {
	private readonly logger = new Logger(ChatNotifierService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly eventBus: EventBus,
		private readonly mentions: MentionService
	) {}

	/** Tells the mentioned employees (never the author). */
	notifyMentions(message: ChatMessage, conversation: ChatConversation, mentionedEmployeeIds: readonly ID[]): void {
		for (const mentionedEmployeeId of mentionedEmployeeIds) {
			try {
				this.mentions.publishMention({
					entity: BaseEntityEnum.ChatMessage,
					entityId: message.id as ID,
					parentEntityId: conversation.id as ID,
					parentEntityType: BaseEntityEnum.ChatConversation,
					mentionedEmployeeId,
					employeeId: message.authorEmployeeId ?? undefined,
					actorType: ActorTypeEnum.User,
					entityName: conversation.name ?? 'chat',
					organizationId: conversation.organizationId ?? undefined,
					tenantId: conversation.tenantId
				});
			} catch (error) {
				this.logger.warn(`Mention of ${mentionedEmployeeId} in message ${message.id} was not published: ${(error as Error)?.message}`);
			}
		}
	}

	/** Tells the other members of a direct or group conversation, by their notify level. */
	notifyDirect(message: ChatMessage, conversation: ChatConversation, members: readonly ChatMember[], mentioned: readonly ID[]): void {
		if (conversation.kind === ChatConversationKindEnum.CHANNEL) return;
		const authorName = authorDisplayName(RequestContext.currentUser());
		for (const member of members) {
			if (!member.employeeId || String(member.employeeId) === String(message.authorEmployeeId ?? '')) continue;
			if (member.notifyLevel === ChatNotifyLevelEnum.MUTED) continue;
			if (member.notifyLevel === ChatNotifyLevelEnum.MENTIONS && !mentioned.map(String).includes(String(member.employeeId))) continue;
			if (mentioned.map(String).includes(String(member.employeeId))) continue; // the mention already tells them
			this.publishMessageNotification(message, conversation, member.employeeId, authorName);
		}
	}

	/**
	 * Tells the followers of a thread about a reply: the members of the conversation who follow it, by their notify
	 * level (a muted or mentions-only member is not told), never the author, never someone already mentioned.
	 */
	notifyThread(message: ChatMessage, conversation: ChatConversation, followers: readonly ChatMember[], mentioned: readonly ID[]): void {
		const authorName = authorDisplayName(RequestContext.currentUser());
		for (const follower of followers) {
			const employeeId = follower.employeeId;
			if (!employeeId || String(employeeId) === String(message.authorEmployeeId ?? '')) continue;
			if (follower.notifyLevel === ChatNotifyLevelEnum.MUTED || follower.notifyLevel === ChatNotifyLevelEnum.MENTIONS) continue;
			if (mentioned.map(String).includes(String(employeeId))) continue;
			this.publishMessageNotification(message, conversation, employeeId, authorName);
		}
	}

	/**
	 * Marks the caller's chat notifications about a conversation read (best effort, through the notification rows):
	 * the message notifications of the messages read (up to `upTo` when the read is partial), and — on a full read —
	 * the mention notifications, which the mention service files against the conversation.
	 *
	 * A reply that lives in its thread only (`threadRootId` set, `alsoInConversation` false) is not a message of the
	 * conversation's timeline, so reading the conversation leaves its notification unread: it clears when the thread
	 * is read (`markThreadRead`). A reply also sent to the conversation is read with it.
	 */
	async markConversationRead(conversationId: ID, caller: { tenantId: ID; employeeId: ID }, upTo?: Pick<ChatMessage, 'createdAt'> | null): Promise<number> {
		try {
			// `entityId` is text while a message id is a uuid on Postgres: the subquery answers text on every dialect.
			const textType = this.dataSource.options.type === 'mysql' ? 'CHAR(36)' : 'TEXT';
			const messageIds = this.dataSource
				.getRepository(ChatMessage)
				.createQueryBuilder('message')
				.select(`CAST(message.id AS ${textType})`)
				.where('message.conversationId = :conversationId', { conversationId })
				.andWhere('message.tenantId = :tenantId', { tenantId: caller.tenantId })
				.andWhere(
					new Brackets((timeline) => {
						timeline.where('message.threadRootId IS NULL').orWhere('message.alsoInConversation = :alsoInConversation', { alsoInConversation: true });
					})
				);
			if (upTo?.createdAt) messageIds.andWhere('message.createdAt <= :upToAt', { upToAt: upTo.createdAt });
			const notifications = this.dataSource.getRepository(EmployeeNotification);
			const query = notifications
				.createQueryBuilder('notification')
				.select('notification.id', 'id')
				.where('notification.tenantId = :tenantId', { tenantId: caller.tenantId })
				.andWhere('notification.receiverEmployeeId = :employeeId', { employeeId: caller.employeeId })
				.andWhere('notification.isRead = :unread', { unread: false })
				.andWhere(
					new Brackets((where) => {
						where.where(`notification.entity = :messageEntity AND notification.entityId IN (${messageIds.getQuery()})`, { messageEntity: BaseEntityEnum.ChatMessage });
						if (!upTo) {
							where.orWhere('notification.entity = :conversationEntity AND notification.entityId = :conversationId', {
								conversationEntity: BaseEntityEnum.ChatConversation,
								conversationId
							});
						}
					})
				)
				.setParameters(messageIds.getParameters());
			const unread = await query.getRawMany<{ id: ID }>();
			if (!unread.length) return 0;
			await notifications.update({ id: In(unread.map((row) => row.id)) }, { isRead: true, readAt: new Date() });
			return unread.length;
		} catch (error) {
			this.logger.warn(`Chat notifications of conversation ${conversationId} were not marked read: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/**
	 * Marks the caller's notifications about the replies of one thread read (best effort): the message notifications
	 * whose message is a reply to the root, and nothing else of the conversation.
	 */
	async markThreadRead(rootMessageId: ID, caller: { tenantId: ID; employeeId: ID }): Promise<number> {
		try {
			const textType = this.dataSource.options.type === 'mysql' ? 'CHAR(36)' : 'TEXT';
			const replyIds = this.dataSource
				.getRepository(ChatMessage)
				.createQueryBuilder('reply')
				.select(`CAST(reply.id AS ${textType})`)
				.where('reply.threadRootId = :rootMessageId', { rootMessageId })
				.andWhere('reply.tenantId = :tenantId', { tenantId: caller.tenantId });
			const notifications = this.dataSource.getRepository(EmployeeNotification);
			const unread = await notifications
				.createQueryBuilder('notification')
				.select('notification.id', 'id')
				.where('notification.tenantId = :tenantId', { tenantId: caller.tenantId })
				.andWhere('notification.receiverEmployeeId = :employeeId', { employeeId: caller.employeeId })
				.andWhere('notification.isRead = :unread', { unread: false })
				.andWhere(`notification.entity = :messageEntity AND notification.entityId IN (${replyIds.getQuery()})`, { messageEntity: BaseEntityEnum.ChatMessage })
				.setParameters(replyIds.getParameters())
				.getRawMany<{ id: ID }>();
			if (!unread.length) return 0;
			await notifications.update({ id: In(unread.map((row) => row.id)) }, { isRead: true, readAt: new Date() });
			return unread.length;
		} catch (error) {
			this.logger.warn(`Chat notifications of thread ${rootMessageId} were not marked read: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/** Marks every chat notification of the caller read (a mark-all-read; best effort). */
	async markAllRead(caller: { tenantId: ID; employeeId: ID }): Promise<number> {
		try {
			const result = await this.dataSource.getRepository(EmployeeNotification).update(
				{
					tenantId: caller.tenantId,
					receiverEmployeeId: caller.employeeId,
					isRead: false,
					entity: In([BaseEntityEnum.ChatMessage, BaseEntityEnum.ChatConversation])
				},
				{ isRead: true, readAt: new Date() }
			);
			return result.affected ?? 0;
		} catch (error) {
			this.logger.warn(`Chat notifications were not marked read: ${(error as Error)?.message}`);
			return 0;
		}
	}

	private publishMessageNotification(message: ChatMessage, conversation: ChatConversation, receiverEmployeeId: ID, authorName: string): void {
		try {
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					entity: BaseEntityEnum.ChatMessage,
					entityId: message.id as ID,
					type: EmployeeNotificationTypeEnum.MESSAGE,
					title: messageNotificationTitle(authorName, conversation, message),
					receiverEmployeeId,
					...(message.authorEmployeeId ? { sentByEmployeeId: message.authorEmployeeId } : {}),
					organizationId: conversation.organizationId ?? undefined,
					tenantId: conversation.tenantId
				})
			);
		} catch (error) {
			this.logger.warn(`Message notification for ${receiverEmployeeId} was not published: ${(error as Error)?.message}`);
		}
	}
}
