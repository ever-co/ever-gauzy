import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Brackets, DataSource, EntityManager, In, IsNull, Not, SelectQueryBuilder } from 'typeorm';
import {
	ActorTypeEnum,
	CHAT_EVENT_NAMES,
	CHAT_MESSAGE_MAX_ATTACHMENTS,
	CHAT_MESSAGE_MAX_LENGTH,
	ChatConversationKindEnum,
	ChatMessageKindEnum,
	ChatTaskReferenceKindEnum,
	IChatEvent,
	IChatMessageCreateInput,
	IChatMessagePage,
	IChatMessagesQuery,
	IChatMessageUpdateInput,
	IChatMessageWithRelations,
	IChatReactionSummary,
	IChatReadAllResult,
	IChatSendResult,
	IChatTaskReference,
	ID,
	ReactionEntityEnum
} from '@gauzy/contracts';
import { Reaction } from '@gauzy/core';
import { mentionedEmployees, parseMentions } from '../chat-mentions';
import { CHAT_MAX_PAGE_SIZE, CHAT_NONCE_TTL_MS, CHAT_PAGE_SIZE, CHAT_READ_RESTORE_TTL_MS } from '../chat.constants';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatTaskReference } from '../entities/chat-task-reference.entity';
import { ChatThreadFollow } from '../entities/chat-thread-follow.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatNotifierService } from './chat-notifier.service';

/** A member row's read state before a mark-all-read, kept for a minute so it can be undone. */
interface ReadSnapshot {
	tenantId: ID;
	userId: ID;
	at: number;
	rows: Array<{ id: ID; readCount: number; mentionCount: number; lastReadMessageId: ID | null }>;
}

/** Parses a JSON array column into ids. */
export function idsOf(json: string | null | undefined): ID[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

/** Whether a message belongs to the conversation's timeline (not a thread reply kept inside its thread). */
export function inTimeline(message: Pick<ChatMessage, 'threadRootId' | 'alsoInConversation'>): boolean {
	return !message.threadRootId || !!message.alsoInConversation;
}

/**
 * Messages: send, edit, delete, pin, threads, follows, reactions, read state and paging.
 *
 * Counters, not count queries: the message write and the counter updates run in one transaction; a member's unread
 * count is `conversation.messageCount − member.readCount`. Every write answers the facts it caused so the sender
 * applies them at once; the same facts reach the other members over the outbox.
 */
@Injectable()
export class ChatMessageService {
	private readonly logger = new Logger(ChatMessageService.name);
	private readonly snapshots = new Map<string, ReadSnapshot>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly realtime: ChatRealtime,
		private readonly notifier: ChatNotifierService
	) {}

	// ---------------------------------------------------------------- reads

	async list(caller: IChatCaller, conversationId: ID, query: IChatMessagesQuery): Promise<IChatMessagePage> {
		await this.access.requireMember(conversationId, caller);
		const limit = Math.min(Math.max(Number(query.limit) || CHAT_PAGE_SIZE, 1), CHAT_MAX_PAGE_SIZE);
		const repository = this.dataSource.getRepository(ChatMessage);
		const base = () =>
			repository
				.createQueryBuilder('message')
				.withDeleted()
				.where('message.conversationId = :conversationId', { conversationId })
				.andWhere('message.tenantId = :tenantId', { tenantId: caller.tenantId })
				// Thread replies live in their thread unless also sent to the conversation.
				.andWhere(
					new Brackets((where) => {
						where.where('message.threadRootId IS NULL');
						where.orWhere('message.alsoInConversation = :also', { also: true });
					})
				)
				// A deleted message stays only as the tombstone of a thread.
				.andWhere(
					new Brackets((where) => {
						where.where('message.deletedAt IS NULL');
						where.orWhere('message.replyCount > 0');
					})
				);

		const anchorId = query.around ?? query.before ?? query.after;
		const anchor = anchorId ? await repository.findOne({ where: { id: anchorId, conversationId, tenantId: caller.tenantId }, withDeleted: true }) : null;
		if (anchorId && !anchor) throw new NotFoundException('The requested record was not found');

		let rows: ChatMessage[];
		let hasBefore = false;
		let hasAfter = false;
		if (anchor && query.around) {
			const half = Math.max(1, Math.floor(limit / 2));
			const before = await this.olderThan(base(), anchor, half + 1).getMany();
			const after = await this.newerThan(base(), anchor, half + 1).getMany();
			hasBefore = before.length > half;
			hasAfter = after.length > half;
			rows = [...before.slice(0, half).reverse(), anchor, ...after.slice(0, half)];
		} else if (anchor && query.after) {
			const after = await this.newerThan(base(), anchor, limit + 1).getMany();
			hasAfter = after.length > limit;
			hasBefore = true;
			rows = after.slice(0, limit);
		} else if (anchor && query.before) {
			const before = await this.olderThan(base(), anchor, limit + 1).getMany();
			hasBefore = before.length > limit;
			hasAfter = true;
			rows = before.slice(0, limit).reverse();
		} else {
			const newest = await base().orderBy('message.createdAt', 'DESC').addOrderBy('message.id', 'DESC').take(limit + 1).getMany();
			hasBefore = newest.length > limit;
			rows = newest.slice(0, limit).reverse();
		}
		return { messages: await this.withRelations(caller, rows), hasBefore, hasAfter };
	}

	/** The replies of a thread, oldest first. */
	async thread(caller: IChatCaller, rootMessageId: ID, query: IChatMessagesQuery): Promise<IChatMessagePage & { root: IChatMessageWithRelations }> {
		const root = await this.messageForCaller(caller, rootMessageId);
		const limit = Math.min(Math.max(Number(query.limit) || CHAT_PAGE_SIZE, 1), CHAT_MAX_PAGE_SIZE);
		const replies = await this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
			.where('message.threadRootId = :rootMessageId', { rootMessageId })
			.andWhere('message.tenantId = :tenantId', { tenantId: caller.tenantId })
			.orderBy('message.createdAt', 'ASC')
			.addOrderBy('message.id', 'ASC')
			.take(limit + 1)
			.getMany();
		const [withRoot, ...rest] = await this.withRelations(caller, [root, ...replies.slice(0, limit)]);
		return { root: withRoot, messages: rest, hasBefore: false, hasAfter: replies.length > limit };
	}

	async pins(caller: IChatCaller, conversationId: ID): Promise<IChatMessageWithRelations[]> {
		await this.access.requireMember(conversationId, caller);
		const rows = await this.dataSource.getRepository(ChatMessage).find({
			where: { conversationId, tenantId: caller.tenantId, pinnedAt: Not(IsNull()) },
			order: { pinnedAt: 'DESC' },
			take: CHAT_MAX_PAGE_SIZE
		});
		return this.withRelations(caller, rows);
	}

	/** The followed threads of the caller: root messages with unread reply counts, most recent reply first. */
	async followedThreads(caller: IChatCaller): Promise<Array<IChatMessageWithRelations & { unreadReplies: number }>> {
		if (!caller.employeeId) return [];
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({ where: { tenantId: caller.tenantId, employeeId: caller.employeeId } });
		if (!follows.length) return [];
		const roots = await this.dataSource.getRepository(ChatMessage).find({
			where: { id: In(follows.map((follow) => follow.rootMessageId)), tenantId: caller.tenantId },
			withDeleted: true,
			order: { lastReplyAt: 'DESC' },
			take: CHAT_MAX_PAGE_SIZE
		});
		const unread = new Map(follows.map((follow) => [String(follow.rootMessageId), follow.unreadReplies ?? 0]));
		const withRelations = await this.withRelations(caller, roots);
		return withRelations.map((root) => ({ ...root, unreadReplies: unread.get(String(root.id)) ?? 0 }));
	}

	// ---------------------------------------------------------------- send / edit / delete

	async send(caller: IChatCaller & { employeeId: ID }, conversationId: ID, input: IChatMessageCreateInput): Promise<IChatSendResult> {
		const { conversation, member } = await this.access.requireMember(conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		const body = this.validBody(input.body);
		const attachmentIds = this.validAttachments(input.attachmentIds);

		// The same send twice (a retry) answers the same message.
		if (input.nonce) {
			const existing = await this.dataSource.getRepository(ChatMessage).findOne({
				where: { authorUserId: caller.userId, nonce: input.nonce, tenantId: caller.tenantId }
			});
			if (existing && Date.now() - new Date(existing.createdAt as Date).getTime() < CHAT_NONCE_TTL_MS) {
				const [message] = await this.withRelations(caller, [existing]);
				return { message, events: [] };
			}
		}

		let root: ChatMessage | null = null;
		if (input.threadRootId) {
			root = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: input.threadRootId, conversationId, tenantId: caller.tenantId }, withDeleted: true });
			if (!root) throw new NotFoundException('The thread was not found');
			if (root.threadRootId) throw new BadRequestException('A reply goes to the root of its thread.');
		}
		if (input.replyToId) {
			const quoted = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: input.replyToId, conversationId, tenantId: caller.tenantId } });
			if (!quoted) throw new NotFoundException('The quoted message was not found');
		}

		const members = await this.access.members(caller.tenantId, conversationId);
		const mentioned = mentionedEmployees(body, input.mentionEmployeeIds, members.map((m) => m.employeeId), caller.employeeId);
		const parsed = parseMentions(body);
		const timeline = !root || !!input.alsoInConversation;
		const now = new Date();

		const message = await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(ChatMessage);
			const created = await repository.save(
				repository.create({
					conversationId,
					authorEmployeeId: caller.employeeId,
					authorUserId: caller.userId,
					kind: ChatMessageKindEnum.MESSAGE,
					body,
					mentionEmployeeIds: mentioned.length ? JSON.stringify(mentioned) : null,
					mentionsChannel: parsed.channel,
					mentionsHere: parsed.here,
					replyToId: input.replyToId ?? undefined,
					threadRootId: root ? (root.id as ID) : undefined,
					alsoInConversation: !!root && !!input.alsoInConversation,
					replyCount: 0,
					attachmentIds: attachmentIds.length ? JSON.stringify(attachmentIds) : null,
					nonce: input.nonce ?? null,
					tenantId: caller.tenantId,
					organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
				})
			);
			if (timeline) {
				await manager.getRepository(ChatConversation).increment({ id: conversationId }, 'messageCount', 1);
				await manager.getRepository(ChatConversation).update({ id: conversationId }, { lastMessageAt: now });
				const count = await manager.getRepository(ChatConversation).findOne({ select: { id: true, messageCount: true }, where: { id: conversationId } });
				await manager
					.getRepository(ChatMember)
					.update({ id: member.id }, { readCount: count?.messageCount ?? (conversation.messageCount ?? 0) + 1, lastReadMessageId: created.id as ID, lastReadAt: now });
				const broadcast = parsed.channel || parsed.here;
				const targets = broadcast ? members.filter((m) => String(m.employeeId) !== String(caller.employeeId)).map((m) => m.id) : members.filter((m) => mentioned.includes(String(m.employeeId))).map((m) => m.id);
				if (targets.length) {
					await manager.getRepository(ChatMember).increment({ id: In(targets) }, 'mentionCount', 1);
				}
			}
			if (root) {
				await manager.getRepository(ChatMessage).increment({ id: root.id }, 'replyCount', 1);
				await manager.getRepository(ChatMessage).update({ id: root.id }, { lastReplyAt: now });
				await this.follow(manager, root, caller, true);
				if (root.authorEmployeeId && String(root.authorEmployeeId) !== String(caller.employeeId)) {
					const rootAuthor = members.find((m) => String(m.employeeId) === String(root!.authorEmployeeId));
					if (rootAuthor) await this.follow(manager, root, { tenantId: caller.tenantId, organizationId: caller.organizationId, employeeId: rootAuthor.employeeId, userId: rootAuthor.userId }, false);
				}
				await manager
					.getRepository(ChatThreadFollow)
					.increment({ rootMessageId: root.id as ID, employeeId: Not(caller.employeeId), tenantId: caller.tenantId }, 'unreadReplies', 1);
			}
			if (input.taskId) {
				await manager.getRepository(ChatTaskReference).save(
					manager.getRepository(ChatTaskReference).create({
						messageId: created.id as ID,
						taskId: input.taskId,
						kind: ChatTaskReferenceKindEnum.SENT,
						tenantId: caller.tenantId,
						organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
					})
				);
			}
			return created;
		});

		// Notifications and real time, after the write (best effort).
		this.notifier.notifyMentions(message, conversation, mentioned);
		if (root) {
			const followers = await this.dataSource.getRepository(ChatThreadFollow).find({ where: { rootMessageId: root.id as ID, tenantId: caller.tenantId } });
			this.notifier.notifyThread(message, conversation, followers.map((follow) => follow.employeeId), mentioned);
		} else {
			this.notifier.notifyDirect(message, conversation, members, mentioned);
		}
		const recipients = members.map((m) => m.userId);
		const events: IChatEvent[] = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_CREATED, message, recipients))];
		if (root) {
			const followers = await this.dataSource.getRepository(ChatThreadFollow).find({ where: { rootMessageId: root.id as ID, tenantId: caller.tenantId } });
			events.push(await this.realtime.publish(this.realtime.threadFact({ ...root, replyCount: (root.replyCount ?? 0) + 1 }, followers.map((follow) => follow.userId))));
		}
		if (timeline) {
			for (const m of members) {
				if (String(m.id) === String(member.id)) continue;
				events.push(await this.realtime.publish(this.realtime.memberStateFact({ ...m, readCount: m.readCount, mentionCount: m.mentionCount + (mentioned.includes(String(m.employeeId)) || parsed.channel || parsed.here ? 1 : 0) })));
			}
		}
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	async edit(caller: IChatCaller, messageId: ID, input: IChatMessageUpdateInput): Promise<IChatSendResult> {
		const message = await this.messageForCaller(caller, messageId);
		if (String(message.authorUserId ?? '') !== String(caller.userId)) throw new ForbiddenException('Only the author can edit a message.');
		if (message.deletedAt) throw new BadRequestException('A deleted message cannot be edited.');
		const body = this.validBody(input.body);
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const before = idsOf(message.mentionEmployeeIds);
		const mentioned = mentionedEmployees(body, input.mentionEmployeeIds, members.map((m) => m.employeeId), caller.employeeId);
		const parsed = parseMentions(body);
		message.body = body;
		message.mentionEmployeeIds = mentioned.length ? JSON.stringify(mentioned) : null;
		message.mentionsChannel = parsed.channel;
		message.mentionsHere = parsed.here;
		if (input.attachmentIds) message.attachmentIds = this.validAttachments(input.attachmentIds).length ? JSON.stringify(this.validAttachments(input.attachmentIds)) : null;
		message.editedAt = new Date();
		await this.dataSource.getRepository(ChatMessage).save(message);
		const conversation = await this.access.conversation(caller.tenantId, message.conversationId);
		// Only the newly mentioned are told.
		this.notifier.notifyMentions(message, conversation, mentioned.filter((id) => !before.includes(id)));
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	async remove(caller: IChatCaller, messageId: ID): Promise<{ events: IChatEvent[] }> {
		const message = await this.messageForCaller(caller, messageId);
		if (String(message.authorUserId ?? '') !== String(caller.userId) && !caller.canManage) {
			throw new ForbiddenException('Only the author or a chat manager can delete a message.');
		}
		const members = await this.access.members(caller.tenantId, message.conversationId);
		await this.dataSource.getRepository(ChatMessage).update({ id: message.id }, {
			// A thread root keeps its row as a tombstone; a plain message is withdrawn.
			body: '',
			attachmentIds: null,
			mentionEmployeeIds: null,
			deletedAt: new Date()
		} as never);
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_DELETED, message, members.map((m) => m.userId)))];
		return { events };
	}

	async pin(caller: IChatCaller, messageId: ID, pinned: boolean): Promise<IChatSendResult> {
		const message = await this.messageForCaller(caller, messageId);
		message.pinnedAt = pinned ? (message.pinnedAt ?? new Date()) : undefined;
		message.pinnedByEmployeeId = pinned ? (caller.employeeId ?? undefined) : undefined;
		await this.dataSource.getRepository(ChatMessage).save(message);
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	// ---------------------------------------------------------------- reactions

	async react(caller: IChatCaller & { employeeId: ID }, messageId: ID, emoji: string, add: boolean): Promise<IChatSendResult> {
		const message = await this.messageForCaller(caller, messageId);
		const value = (emoji ?? '').trim();
		if (!value || value.length > 32) throw new BadRequestException('State an emoji.');
		const repository = this.dataSource.getRepository(Reaction);
		const where = { entity: ReactionEntityEnum.ChatMessage, entityId: message.id as ID, emoji: value, employeeId: caller.employeeId, tenantId: caller.tenantId };
		const existing = await repository.findOne({ where });
		if (add && !existing) {
			await repository.save(
				repository.create({ ...where, actorType: ActorTypeEnum.User, organizationId: message.organizationId ?? caller.organizationId ?? undefined } as never)
			);
		} else if (!add && existing) {
			await repository.remove(existing);
		}
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	// ---------------------------------------------------------------- threads

	async setFollow(caller: IChatCaller & { employeeId: ID }, rootMessageId: ID, following: boolean): Promise<{ following: boolean; events: IChatEvent[] }> {
		const root = await this.messageForCaller(caller, rootMessageId);
		if (root.threadRootId) throw new BadRequestException('Follow the root of the thread.');
		if (following) {
			await this.follow(this.dataSource.manager, root, caller, true);
		} else {
			await this.dataSource.getRepository(ChatThreadFollow).delete({ rootMessageId: root.id as ID, employeeId: caller.employeeId, tenantId: caller.tenantId });
		}
		return { following, events: [] };
	}

	// ---------------------------------------------------------------- read state

	/** Marks the conversation read up to a message (default: everything). */
	async read(caller: IChatCaller & { employeeId: ID }, conversationId: ID, messageId?: ID): Promise<{ events: IChatEvent[] }> {
		const { conversation, member } = await this.access.requireMember(conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		let readCount = conversation.messageCount ?? 0;
		let lastReadMessageId: ID | null = null;
		if (messageId) {
			const anchor = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, conversationId, tenantId: caller.tenantId }, withDeleted: true });
			if (!anchor) throw new NotFoundException('The requested record was not found');
			readCount = await this.timelinePosition(caller.tenantId, conversationId, anchor, true);
			lastReadMessageId = anchor.id as ID;
		} else {
			const newest = await this.dataSource.getRepository(ChatMessage).findOne({
				where: { conversationId, tenantId: caller.tenantId },
				order: { createdAt: 'DESC' },
				withDeleted: true
			});
			lastReadMessageId = (newest?.id as ID) ?? null;
		}
		member.readCount = Math.max(member.readCount ?? 0, readCount);
		member.mentionCount = 0;
		member.lastReadMessageId = lastReadMessageId ?? undefined;
		member.lastReadAt = new Date();
		await this.dataSource.getRepository(ChatMember).save(member);
		// Thread replies the caller follows in this conversation are read too when reading everything.
		if (!messageId) {
			await this.dataSource
				.getRepository(ChatThreadFollow)
				.createQueryBuilder()
				.update()
				.set({ unreadReplies: 0, lastReadReplyAt: new Date() })
				.where('employeeId = :employeeId AND tenantId = :tenantId', { employeeId: caller.employeeId, tenantId: caller.tenantId })
				.andWhere(`rootMessageId IN (${this.dataSource.getRepository(ChatMessage).createQueryBuilder('m').select('m.id').where('m.conversationId = :conversationId').getQuery()})`, { conversationId })
				.execute();
		}
		void this.notifier.markConversationRead(conversationId, { tenantId: caller.tenantId, employeeId: caller.employeeId });
		return { events: [await this.realtime.publish(this.realtime.memberStateFact(member))] };
	}

	/** Marks the conversation unread from a message on (the message itself included). */
	async unreadFrom(caller: IChatCaller & { employeeId: ID }, messageId: ID): Promise<{ events: IChatEvent[] }> {
		const message = await this.messageForCaller(caller, messageId);
		const member = await this.access.membership(message.conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		member.readCount = await this.timelinePosition(caller.tenantId, message.conversationId, message, false);
		member.lastReadMessageId = undefined;
		await this.dataSource.getRepository(ChatMember).save(member);
		return { events: [await this.realtime.publish(this.realtime.memberStateFact(member))] };
	}

	/** Marks every conversation of the caller read; answers an undo handle valid for a minute. */
	async readAll(caller: IChatCaller & { employeeId: ID }): Promise<IChatReadAllResult & { events: IChatEvent[] }> {
		const members = await this.dataSource.getRepository(ChatMember).find({ where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() } });
		const conversations = members.length
			? await this.dataSource.getRepository(ChatConversation).find({ select: { id: true, messageCount: true }, where: { id: In(members.map((m) => m.conversationId)), tenantId: caller.tenantId } })
			: [];
		const counts = new Map(conversations.map((c) => [String(c.id), c.messageCount ?? 0]));
		const snapshot: ReadSnapshot = { tenantId: caller.tenantId, userId: caller.userId, at: Date.now(), rows: [] };
		const events: IChatEvent[] = [];
		let updated = 0;
		for (const member of members) {
			const total = counts.get(String(member.conversationId)) ?? 0;
			if ((member.readCount ?? 0) >= total && !(member.mentionCount > 0)) continue;
			snapshot.rows.push({ id: member.id as ID, readCount: member.readCount ?? 0, mentionCount: member.mentionCount ?? 0, lastReadMessageId: member.lastReadMessageId ?? null });
			member.readCount = total;
			member.mentionCount = 0;
			member.lastReadAt = new Date();
			await this.dataSource.getRepository(ChatMember).save(member);
			events.push(await this.realtime.publish(this.realtime.memberStateFact(member)));
			updated += 1;
		}
		await this.dataSource.getRepository(ChatThreadFollow).update({ tenantId: caller.tenantId, employeeId: caller.employeeId }, { unreadReplies: 0, lastReadReplyAt: new Date() });
		const snapshotId = randomUUID();
		this.snapshots.set(snapshotId, snapshot);
		this.pruneSnapshots();
		return { updated, snapshotId, events };
	}

	/** Undoes a mark-all-read within its minute. */
	async restoreRead(caller: IChatCaller, snapshotId: string): Promise<{ restored: number; events: IChatEvent[] }> {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot || String(snapshot.userId) !== String(caller.userId) || Date.now() - snapshot.at > CHAT_READ_RESTORE_TTL_MS) {
			throw new NotFoundException('Nothing to undo.');
		}
		this.snapshots.delete(snapshotId);
		const repository = this.dataSource.getRepository(ChatMember);
		const events: IChatEvent[] = [];
		for (const row of snapshot.rows) {
			const member = await repository.findOne({ where: { id: row.id, tenantId: caller.tenantId } });
			if (!member) continue;
			member.readCount = row.readCount;
			member.mentionCount = row.mentionCount;
			member.lastReadMessageId = row.lastReadMessageId ?? undefined;
			await repository.save(member);
			events.push(await this.realtime.publish(this.realtime.memberStateFact(member)));
		}
		return { restored: snapshot.rows.length, events };
	}

	// ---------------------------------------------------------------- helpers

	/** A message the caller may read (a member of its conversation), or not found. */
	async messageForCaller(caller: IChatCaller, messageId: ID): Promise<ChatMessage> {
		const message = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, tenantId: caller.tenantId }, withDeleted: true });
		if (!message) throw new NotFoundException('The requested record was not found');
		await this.access.requireMember(message.conversationId, caller);
		return message;
	}

	/** Reactions and task references of the messages, and the caller's follow state. */
	async withRelations(caller: IChatCaller, rows: ChatMessage[]): Promise<IChatMessageWithRelations[]> {
		if (!rows.length) return [];
		const ids = rows.map((row) => row.id as ID);
		const [reactions, references, follows] = await Promise.all([
			this.dataSource.getRepository(Reaction).find({ where: { entity: ReactionEntityEnum.ChatMessage, entityId: In(ids), tenantId: caller.tenantId } }),
			this.dataSource.getRepository(ChatTaskReference).find({ where: { messageId: In(ids), tenantId: caller.tenantId } }),
			caller.employeeId
				? this.dataSource.getRepository(ChatThreadFollow).find({ select: { rootMessageId: true }, where: { rootMessageId: In(ids), employeeId: caller.employeeId, tenantId: caller.tenantId } })
				: Promise.resolve([] as ChatThreadFollow[])
		]);
		const reactionsOf = new Map<string, Map<string, IChatReactionSummary>>();
		for (const reaction of reactions) {
			const perMessage = reactionsOf.get(String(reaction.entityId)) ?? new Map<string, IChatReactionSummary>();
			const summary = perMessage.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
			summary.count += 1;
			if (String(reaction.employeeId ?? '') === String(caller.employeeId ?? '')) summary.mine = true;
			perMessage.set(reaction.emoji, summary);
			reactionsOf.set(String(reaction.entityId), perMessage);
		}
		const referencesOf = new Map<string, IChatTaskReference[]>();
		for (const reference of references) {
			const list = referencesOf.get(String(reference.messageId)) ?? [];
			list.push({ messageId: reference.messageId, taskId: reference.taskId, kind: reference.kind });
			referencesOf.set(String(reference.messageId), list);
		}
		const followed = new Set(follows.map((follow) => String(follow.rootMessageId)));
		return rows.map((row) => ({
			...(row as unknown as IChatMessageWithRelations),
			mentionEmployeeIds: idsOf(row.mentionEmployeeIds),
			attachmentIds: idsOf(row.attachmentIds),
			reactions: [...(reactionsOf.get(String(row.id))?.values() ?? [])],
			taskReferences: referencesOf.get(String(row.id)) ?? [],
			following: followed.has(String(row.id))
		}));
	}

	private validBody(body: string | undefined): string {
		const value = (body ?? '').replace(/\r\n/g, '\n').trim();
		if (!value) throw new BadRequestException('A message needs a body.');
		if (value.length > CHAT_MESSAGE_MAX_LENGTH) throw new BadRequestException(`A message holds at most ${CHAT_MESSAGE_MAX_LENGTH} characters.`);
		return value;
	}

	private validAttachments(ids: readonly ID[] | undefined): ID[] {
		const list = [...new Set((ids ?? []).map(String).filter(Boolean))];
		if (list.length > CHAT_MESSAGE_MAX_ATTACHMENTS) throw new BadRequestException(`A message carries at most ${CHAT_MESSAGE_MAX_ATTACHMENTS} attachments.`);
		return list;
	}

	private olderThan(query: SelectQueryBuilder<ChatMessage>, anchor: ChatMessage, take: number): SelectQueryBuilder<ChatMessage> {
		return query
			.andWhere(
				new Brackets((where) => {
					where.where('message.createdAt < :anchorAt', { anchorAt: anchor.createdAt });
					where.orWhere('message.createdAt = :anchorAt AND message.id < :anchorId', { anchorAt: anchor.createdAt, anchorId: anchor.id });
				})
			)
			.orderBy('message.createdAt', 'DESC')
			.addOrderBy('message.id', 'DESC')
			.take(take);
	}

	private newerThan(query: SelectQueryBuilder<ChatMessage>, anchor: ChatMessage, take: number): SelectQueryBuilder<ChatMessage> {
		return query
			.andWhere(
				new Brackets((where) => {
					where.where('message.createdAt > :anchorAt', { anchorAt: anchor.createdAt });
					where.orWhere('message.createdAt = :anchorAt AND message.id > :anchorId', { anchorAt: anchor.createdAt, anchorId: anchor.id });
				})
			)
			.orderBy('message.createdAt', 'ASC')
			.addOrderBy('message.id', 'ASC')
			.take(take);
	}

	/** How many timeline messages (deleted ones included) come before a message — plus the message itself when `inclusive`. */
	private async timelinePosition(tenantId: ID, conversationId: ID, anchor: ChatMessage, inclusive: boolean): Promise<number> {
		const count = await this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
			.withDeleted()
			.where('message.conversationId = :conversationId', { conversationId })
			.andWhere('message.tenantId = :tenantId', { tenantId })
			.andWhere(
				new Brackets((where) => {
					where.where('message.threadRootId IS NULL');
					where.orWhere('message.alsoInConversation = :also', { also: true });
				})
			)
			.andWhere(
				new Brackets((where) => {
					where.where('message.createdAt < :anchorAt', { anchorAt: anchor.createdAt });
					where.orWhere(`message.createdAt = :anchorAt AND message.id ${inclusive ? '<=' : '<'} :anchorId`, { anchorAt: anchor.createdAt, anchorId: anchor.id });
				})
			)
			.getCount();
		return count;
	}

	/** Follows a thread for an employee (upsert); a new follow starts with nothing unread when `read` is true. */
	private async follow(
		manager: EntityManager,
		root: ChatMessage,
		who: { tenantId: ID; organizationId: ID | null; employeeId: ID; userId: ID },
		read: boolean
	): Promise<void> {
		const repository = manager.getRepository(ChatThreadFollow);
		const existing = await repository.findOne({ where: { rootMessageId: root.id as ID, employeeId: who.employeeId, tenantId: who.tenantId } });
		if (existing) {
			if (read) await repository.update({ id: existing.id }, { unreadReplies: 0, lastReadReplyAt: new Date() });
			return;
		}
		await repository.save(
			repository.create({
				rootMessageId: root.id as ID,
				employeeId: who.employeeId,
				userId: who.userId,
				unreadReplies: 0,
				lastReadReplyAt: read ? new Date() : undefined,
				tenantId: who.tenantId,
				organizationId: root.organizationId ?? who.organizationId ?? undefined
			})
		);
	}

	private pruneSnapshots(): void {
		const now = Date.now();
		for (const [id, snapshot] of this.snapshots) {
			if (now - snapshot.at > CHAT_READ_RESTORE_TTL_MS) this.snapshots.delete(id);
		}
	}
}
