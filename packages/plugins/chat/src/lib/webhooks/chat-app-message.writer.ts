import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { CHAT_EVENT_NAMES, ChatMessageKindEnum, IChatEvent, ID } from '@gauzy/contracts';
import { mentionedEmployees, parseMentions } from '../chat-mentions';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatWebhook } from '../entities/chat-webhook.entity';
import { ChatWebhookInteraction } from '../entities/chat-webhook-interaction.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { inWriteTransaction } from '../realtime/chat-write-transaction';
import { ChatAccessService } from '../services/chat-access.service';
import { IChatWebhookContent } from './chat-webhook-payload';

/** What a post wrote. */
export interface IChatAppPost {
	message: ChatMessage;
	/** The same nonce was posted before: nothing new was written, `message` is the first post. */
	duplicate: boolean;
	events: IChatEvent[];
}

/**
 * Writes the messages of incoming webhooks: `kind: app`, no employee author, the webhook's name and icon as they are
 * at the time of the post. A post moves the same counters and appends the same facts as a member's send — the
 * conversation's message count, each member's unread count (nobody's read position moves: the author is no member),
 * the mention counts of the members it mentions (everyone's for a broadcast, which only a webhook allowed to
 * broadcast can make) — so unread badges, mentions and the live channel treat it like any other message.
 */
@Injectable()
export class ChatAppMessageWriter {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly realtime: ChatRealtime
	) {}

	async post(webhook: ChatWebhook, conversation: ChatConversation, content: IChatWebhookContent): Promise<IChatAppPost> {
		if (content.nonce) {
			const existing = await this.postedWithNonce(webhook, content.nonce);
			if (existing) return { message: existing, duplicate: true, events: [] };
		}
		const members = await this.access.members(conversation.tenantId as ID, conversation.id as ID);
		const mentioned = mentionedEmployees(content.body, [], members.map((member) => member.employeeId), null);
		const parsed = parseMentions(content.body);
		// The payload reader already turned the broadcast tokens of a webhook that may not broadcast into text; this is
		// the second lock on the same door.
		const channel = !!webhook.canBroadcast && parsed.channel;
		const here = !!webhook.canBroadcast && parsed.here;
		const broadcast = channel || here;
		const now = new Date();
		let message: ChatMessage;
		let events: IChatEvent[];
		try {
			const written = await inWriteTransaction(this.dataSource, async (manager) => {
				const repository = manager.getRepository(ChatMessage);
				const created = await repository.save(
					repository.create({
						conversationId: conversation.id as ID,
						authorEmployeeId: undefined,
						authorUserId: undefined,
						kind: ChatMessageKindEnum.APP,
						body: content.body,
						mentionEmployeeIds: mentioned.length ? JSON.stringify(mentioned) : null,
						mentionsChannel: channel,
						mentionsHere: here,
						alsoInConversation: false,
						replyCount: 0,
						attachmentIds: null,
						nonce: content.nonce,
						webhookId: webhook.id as ID,
						appName: webhook.name,
						appIconUrl: webhook.iconUrl ?? null,
						blocks: content.blocks.length ? JSON.stringify(content.blocks) : null,
						tenantId: conversation.tenantId,
						organizationId: conversation.organizationId ?? webhook.organizationId ?? undefined
					})
				);
				await manager.getRepository(ChatConversation).increment({ id: conversation.id as ID }, 'messageCount', 1);
				await manager.getRepository(ChatConversation).update({ id: conversation.id as ID }, { lastMessageAt: now });
				const targets = broadcast ? members.map((m) => m.id) : members.filter((m) => mentioned.includes(String(m.employeeId))).map((m) => m.id);
				if (targets.length) {
					await manager.getRepository(ChatMember).increment({ id: In(targets) }, 'mentionCount', 1);
				}
				const facts = [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_CREATED, created, members.map((m) => m.userId)))];
				return { created, facts };
			});
			message = written.created;
			events = written.facts;
		} catch (error) {
			// A retry that raced its first attempt: the unique (webhook, nonce) key refused the second row.
			const existing = content.nonce ? await this.postedWithNonce(webhook, content.nonce) : null;
			if (!existing) throw error;
			return { message: existing, duplicate: true, events: [] };
		}

		// After the commit, best effort, as a send does: every member's own counters. The mentions count (badges) as a
		// member's do; no inbox notification is filed for them: the platform's mention and notification writes take the
		// author and the tenant from a signed-in user, and a webhook post has none (plan §12).
		for (const member of members) {
			await this.realtime.publish(
				this.realtime.memberStateFact({
					...member,
					mentionCount: (member.mentionCount ?? 0) + (broadcast || mentioned.includes(String(member.employeeId)) ? 1 : 0)
				})
			);
		}
		return { message, duplicate: false, events };
	}

	/**
	 * Replaces the content of an app message with the sender's reply to an interaction — body and blocks, marked edited
	 * — at most once per interaction: the interaction's `replyAppliedAt` is claimed (a compare-and-set), the message
	 * written and its `chat_message.updated` fact appended in one transaction, so the marker is set only when the
	 * message really changed. Null when nothing changed: the message is gone, its conversation archived meanwhile, or
	 * the reply of this interaction was applied already. Its mentions stay those of the post (no one is told again).
	 */
	async replaceOnce(messageId: ID, interactionId: ID, content: IChatWebhookContent): Promise<{ message: ChatMessage; events: IChatEvent[] } | null> {
		const editedAt = new Date();
		const blocks = content.blocks.length ? JSON.stringify(content.blocks) : null;
		const nothingChanged = new Error('nothing changed');
		const replaced = inWriteTransaction(this.dataSource, async (manager) => {
			const message = await manager.getRepository(ChatMessage).findOne({ where: { id: messageId } });
			if (!message) return null;
			const conversation = await manager.getRepository(ChatConversation).findOne({ select: { id: true, archivedAt: true }, where: { id: message.conversationId } });
			if (!conversation || conversation.archivedAt) return null;
			const claim = await manager
				.getRepository(ChatWebhookInteraction)
				.update({ id: interactionId, replyAppliedAt: IsNull() }, { replyAppliedAt: editedAt } as never);
			if (!(claim.affected ?? 0)) return null;
			const written = await manager.getRepository(ChatMessage).update({ id: message.id as ID, deletedAt: IsNull() }, { body: content.body, blocks, editedAt } as never);
			// Deleted meanwhile: the claim rolls back with the transaction, and nobody is told.
			if (!(written.affected ?? 0)) throw nothingChanged;
			const members = await this.access.members(message.tenantId as ID, message.conversationId, manager);
			const events = [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
			message.body = content.body;
			message.blocks = blocks;
			message.editedAt = editedAt;
			return { message, events };
		});
		return replaced.catch((error) => {
			if (error === nothingChanged) return null;
			throw error;
		});
	}

	private postedWithNonce(webhook: ChatWebhook, nonce: string): Promise<ChatMessage | null> {
		return this.dataSource.getRepository(ChatMessage).findOne({
			where: { webhookId: webhook.id as ID, nonce, tenantId: webhook.tenantId as ID },
			withDeleted: true
		});
	}
}
