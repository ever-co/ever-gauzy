import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, In, IsNull, MoreThan, Not, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
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
import { CHAT_MAX_PAGE_SIZE, CHAT_PAGE_SIZE, CHAT_READ_RESTORE_TTL_MS } from '../chat.constants';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatTaskReference } from '../entities/chat-task-reference.entity';
import { ChatThreadFollow } from '../entities/chat-thread-follow.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatNotifierService } from './chat-notifier.service';

/**
 * The read state a mark-all-read replaced, so it can be undone for a minute. It travels inside the undo handle
 * the caller holds (base64 JSON), not in this process: any API replica can restore it. It needs no signature —
 * restoring applies to the caller's own member rows only, a state the caller may set through the read routes
 * anyway.
 */
export interface ReadSnapshot {
	v: 1;
	tenantId: ID;
	userId: ID;
	employeeId: ID;
	at: number;
	rows: Array<{ id: ID; readCount: number; mentionCount: number; lastReadMessageId: ID | null }>;
	follows: Array<{ id: ID; unreadReplies: number; lastReadReplyAt: string | null }>;
}

export function encodeSnapshot(snapshot: ReadSnapshot): string {
	return Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64url');
}

export function decodeSnapshot(handle: string): ReadSnapshot | null {
	try {
		const parsed = JSON.parse(Buffer.from(String(handle ?? ''), 'base64url').toString('utf8')) as ReadSnapshot;
		if (parsed?.v !== 1 || !parsed.userId || !parsed.tenantId || !Array.isArray(parsed.rows) || !Array.isArray(parsed.follows)) return null;
		return parsed;
	} catch {
		return null;
	}
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

	/** The replies of a thread, oldest first, around / before / after an anchor like the timeline. */
	async thread(caller: IChatCaller, rootMessageId: ID, query: IChatMessagesQuery): Promise<IChatMessagePage & { root: IChatMessageWithRelations }> {
		const root = await this.messageForCaller(caller, rootMessageId);
		const limit = Math.min(Math.max(Number(query.limit) || CHAT_PAGE_SIZE, 1), CHAT_MAX_PAGE_SIZE);
		const repository = this.dataSource.getRepository(ChatMessage);
		const base = () =>
			repository
				.createQueryBuilder('message')
				.where('message.threadRootId = :rootMessageId', { rootMessageId })
				.andWhere('message.tenantId = :tenantId', { tenantId: caller.tenantId });
		const anchorId = query.around ?? query.before ?? query.after;
		const anchor = anchorId
			? await repository.findOne({ where: { id: anchorId, threadRootId: rootMessageId, tenantId: caller.tenantId }, withDeleted: true })
			: null;
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
			const oldest = await base().orderBy('message.createdAt', 'ASC').addOrderBy('message.id', 'ASC').take(limit + 1).getMany();
			hasAfter = oldest.length > limit;
			rows = oldest.slice(0, limit);
		}
		const [withRoot, ...rest] = await this.withRelations(caller, [root, ...rows]);
		return { root: withRoot, messages: rest, hasBefore, hasAfter };
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

	/**
	 * The followed threads of the caller: root messages with unread reply counts, most recent reply first — of the
	 * conversations the caller is still a member of (a follow outlives nothing: leaving drops it, and a thread of a
	 * conversation left is never answered).
	 */
	async followedThreads(caller: IChatCaller): Promise<Array<IChatMessageWithRelations & { unreadReplies: number }>> {
		if (!caller.employeeId) return [];
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({ where: { tenantId: caller.tenantId, employeeId: caller.employeeId } });
		if (!follows.length) return [];
		const memberships = await this.dataSource.getRepository(ChatMember).find({
			select: { conversationId: true },
			where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() }
		});
		if (!memberships.length) return [];
		const roots = await this.dataSource.getRepository(ChatMessage).find({
			where: {
				id: In(follows.map((follow) => follow.rootMessageId)),
				conversationId: In(memberships.map((membership) => membership.conversationId)),
				tenantId: caller.tenantId
			},
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

		// The same send twice (a retry, however late, the message since deleted or not) answers the same message, so
		// the unique (author, nonce) key never refuses a retry.
		if (input.nonce) {
			const existing = await this.sentWithNonce(caller, input.nonce);
			if (existing) {
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
		if (input.taskId) {
			// The task must be the caller's tenant's, and the conversation's organization's when it has one: the
			// foreign key proves only that some task exists.
			const task = await this.dataSource.getRepository<ObjectLiteral>('Task').findOne({
				select: { id: true },
				where: {
					id: input.taskId,
					tenantId: caller.tenantId,
					...(conversation.organizationId ? { organizationId: conversation.organizationId } : {})
				}
			} as never);
			if (!task) throw new NotFoundException('The task was not found');
		}

		const members = await this.access.members(caller.tenantId, conversationId);
		const mentioned = mentionedEmployees(body, input.mentionEmployeeIds, members.map((m) => m.employeeId), caller.employeeId);
		const parsed = parseMentions(body);
		const broadcast = parsed.channel || parsed.here;
		const timeline = !root || !!input.alsoInConversation;
		const now = new Date();

		let message: ChatMessage;
		let readCount = conversation.messageCount ?? 0;
		try {
			const written = await this.dataSource.transaction(async (manager) => {
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
				let count = conversation.messageCount ?? 0;
				if (timeline) {
					await manager.getRepository(ChatConversation).increment({ id: conversationId }, 'messageCount', 1);
					await manager.getRepository(ChatConversation).update({ id: conversationId }, { lastMessageAt: now });
					const fresh = await manager.getRepository(ChatConversation).findOne({ select: { id: true, messageCount: true }, where: { id: conversationId } });
					count = fresh?.messageCount ?? count + 1;
					await manager.getRepository(ChatMember).update({ id: member.id }, { readCount: count, lastReadMessageId: created.id as ID, lastReadAt: now });
					const targets = broadcast
						? members.filter((m) => String(m.employeeId) !== String(caller.employeeId)).map((m) => m.id)
						: members.filter((m) => mentioned.includes(String(m.employeeId))).map((m) => m.id);
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
				return { created, count };
			});
			message = written.created;
			readCount = written.count;
		} catch (error) {
			// A retry that raced its first attempt: the unique (author, nonce) key refused the second row, and the
			// first is the answer.
			const existing = input.nonce ? await this.sentWithNonce(caller, input.nonce) : null;
			if (!existing) throw error;
			const [answer] = await this.withRelations(caller, [existing]);
			return { message: answer, events: [] };
		}

		// Notifications and real time, after the write (best effort). The followers of a thread hear of a reply only
		// while they are members of the conversation, and by their notify level.
		this.notifier.notifyMentions(message, conversation, mentioned);
		const followers = root ? await this.activeFollowers(caller.tenantId, root.id as ID, members) : [];
		if (root) {
			this.notifier.notifyThread(message, conversation, followers, mentioned);
		} else {
			this.notifier.notifyDirect(message, conversation, members, mentioned);
		}
		const recipients = members.map((m) => m.userId);
		const events: IChatEvent[] = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_CREATED, message, recipients))];
		if (root) {
			events.push(await this.realtime.publish(this.realtime.threadFact({ ...root, replyCount: (root.replyCount ?? 0) + 1 }, followers.map((follower) => follower.userId))));
		}
		if (timeline) {
			// Every other member's state reaches them on their own addressed stream, nobody else's; the sender's own
			// comes back in the answer.
			for (const m of members) {
				if (String(m.id) === String(member.id)) continue;
				await this.realtime.publish(
					this.realtime.memberStateFact({ ...m, mentionCount: (m.mentionCount ?? 0) + (broadcast || mentioned.includes(String(m.employeeId)) ? 1 : 0) })
				);
			}
			events.push(await this.realtime.publish(this.realtime.memberStateFact({ ...member, readCount, lastReadMessageId: message.id as ID })));
		}
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	async edit(caller: IChatCaller, messageId: ID, input: IChatMessageUpdateInput): Promise<IChatSendResult> {
		const { message, conversation } = await this.messageForWrite(caller, messageId);
		if (String(message.authorUserId ?? '') !== String(caller.userId)) throw new ForbiddenException('Only the author can edit a message.');
		if (message.deletedAt) throw new BadRequestException('A deleted message cannot be edited.');
		const body = this.validBody(input.body);
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const before = idsOf(message.mentionEmployeeIds);
		const mentioned = mentionedEmployees(body, input.mentionEmployeeIds, members.map((m) => m.employeeId), caller.employeeId);
		const parsed = parseMentions(body);
		const added = mentioned.filter((id) => !before.includes(id));
		const removed = before.filter((id) => !mentioned.includes(id));
		message.body = body;
		message.mentionEmployeeIds = mentioned.length ? JSON.stringify(mentioned) : null;
		message.mentionsChannel = parsed.channel;
		message.mentionsHere = parsed.here;
		if (input.attachmentIds) message.attachmentIds = this.validAttachments(input.attachmentIds).length ? JSON.stringify(this.validAttachments(input.attachmentIds)) : null;
		message.editedAt = new Date();
		await this.dataSource.getRepository(ChatMessage).save(message);
		// A mention the edit added or took away moves the badge of a member who has not read the message yet.
		if (inTimeline(message) && (added.length || removed.length)) {
			const position = await this.timelinePosition(caller.tenantId, message.conversationId, message, true);
			const repository = this.dataSource.getRepository(ChatMember);
			for (const m of members) {
				if ((m.readCount ?? 0) >= position) continue;
				const employeeId = String(m.employeeId);
				if (added.includes(employeeId)) await repository.increment({ id: m.id }, 'mentionCount', 1);
				else if (removed.includes(employeeId) && (m.mentionCount ?? 0) > 0) await repository.decrement({ id: m.id }, 'mentionCount', 1);
			}
		}
		// Only the newly mentioned are told.
		this.notifier.notifyMentions(message, conversation, added);
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	async remove(caller: IChatCaller, messageId: ID): Promise<{ events: IChatEvent[] }> {
		const { message, conversation } = await this.messageForWrite(caller, messageId);
		if (String(message.authorUserId ?? '') !== String(caller.userId) && !caller.canManage) {
			throw new ForbiddenException('Only the author or a chat manager can delete a message.');
		}
		if (message.deletedAt) return { events: [] };
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const mentionedBefore = idsOf(message.mentionEmployeeIds);
		const broadcast = !!message.mentionsChannel || !!message.mentionsHere;
		const timeline = inTimeline(message);
		const position = timeline ? await this.timelinePosition(caller.tenantId, message.conversationId, message, true) : 0;
		await this.dataSource.transaction(async (manager) => {
			await manager.getRepository(ChatMessage).update({ id: message.id }, {
				// A thread root keeps its row as a tombstone; a plain message is withdrawn.
				body: '',
				attachmentIds: null,
				mentionEmployeeIds: null,
				deletedAt: new Date()
			} as never);
			if (timeline) {
				// The timeline is one message shorter: the conversation's count follows, a read position past the end
				// is brought back to it, and a member who had not read the message loses the badge it gave them.
				// Atomic: a send that arrived since the conversation row was read keeps its increment.
				await manager.getRepository(ChatConversation).decrement({ id: conversation.id as ID }, 'messageCount', 1);
				const fresh = await manager.getRepository(ChatConversation).findOne({ select: { id: true, messageCount: true }, where: { id: conversation.id as ID } });
				const total = Math.max(0, fresh?.messageCount ?? (conversation.messageCount ?? 0) - 1);
				if ((fresh?.messageCount ?? 0) < 0) {
					await manager.getRepository(ChatConversation).update({ id: conversation.id as ID }, { messageCount: 0 });
				}
				await manager.getRepository(ChatMember).update({ conversationId: conversation.id as ID, readCount: MoreThan(total) }, { readCount: total });
				for (const m of members) {
					if ((m.readCount ?? 0) >= position || (m.mentionCount ?? 0) <= 0) continue;
					if (broadcast || mentionedBefore.includes(String(m.employeeId))) {
						await manager.getRepository(ChatMember).decrement({ id: m.id }, 'mentionCount', 1);
					}
				}
			}
		});
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_DELETED, message, members.map((m) => m.userId)))];
		return { events };
	}

	async pin(caller: IChatCaller, messageId: ID, pinned: boolean): Promise<IChatSendResult> {
		const { message } = await this.messageForWrite(caller, messageId);
		if (pinned && message.deletedAt) throw new BadRequestException('A deleted message cannot be pinned.');
		const pinnedAt = pinned ? (message.pinnedAt ?? new Date()) : null;
		const pinnedByEmployeeId = pinned ? (caller.employeeId ?? null) : null;
		// Unpinning writes NULL: `save` would leave an undefined member untouched.
		await this.dataSource.getRepository(ChatMessage).update({ id: message.id }, { pinnedAt, pinnedByEmployeeId } as never);
		message.pinnedAt = pinnedAt ?? undefined;
		message.pinnedByEmployeeId = pinnedByEmployeeId ?? undefined;
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const events = [await this.realtime.publish(this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	// ---------------------------------------------------------------- reactions

	async react(caller: IChatCaller & { employeeId: ID }, messageId: ID, emoji: string, add: boolean): Promise<IChatSendResult> {
		const { message } = await this.messageForWrite(caller, messageId);
		if (add && message.deletedAt) throw new BadRequestException('A deleted message cannot be reacted to.');
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

	/** Marks the conversation read up to a message (default: everything); mentions after that message stay unread. */
	async read(caller: IChatCaller & { employeeId: ID }, conversationId: ID, messageId?: ID): Promise<{ events: IChatEvent[] }> {
		const { conversation, member } = await this.access.requireMember(conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		let readCount = conversation.messageCount ?? 0;
		let lastReadMessageId: ID | null = null;
		let mentionCount = 0;
		let anchor: ChatMessage | null = null;
		if (messageId) {
			anchor = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, conversationId, tenantId: caller.tenantId }, withDeleted: true });
			if (!anchor) throw new NotFoundException('The requested record was not found');
			readCount = await this.timelinePosition(caller.tenantId, conversationId, anchor, true);
			lastReadMessageId = anchor.id as ID;
			mentionCount = await this.countMentions(caller.tenantId, conversationId, caller.employeeId, anchor, false);
		} else {
			const newest = await this.dataSource.getRepository(ChatMessage).findOne({
				where: { conversationId, tenantId: caller.tenantId },
				order: { createdAt: 'DESC' },
				withDeleted: true
			});
			lastReadMessageId = (newest?.id as ID) ?? null;
		}
		const now = new Date();
		const patch = { readCount: Math.max(member.readCount ?? 0, readCount), mentionCount, lastReadMessageId, lastReadAt: now };
		// The read columns only: a preference or a counter written since the row was read is not written back.
		await this.dataSource.getRepository(ChatMember).update({ id: member.id }, patch as never);
		Object.assign(member, { ...patch, lastReadMessageId: lastReadMessageId ?? undefined });
		// Thread replies the caller follows in this conversation are read too when reading everything.
		if (!messageId) {
			const followIds = await this.followIdsIn(caller, conversationId);
			if (followIds.length) {
				await this.dataSource.getRepository(ChatThreadFollow).update({ id: In(followIds) }, { unreadReplies: 0, lastReadReplyAt: now });
			}
		}
		void this.notifier.markConversationRead(conversationId, { tenantId: caller.tenantId, employeeId: caller.employeeId }, anchor);
		return { events: [await this.realtime.publish(this.realtime.memberStateFact(member))] };
	}

	/** Marks the conversation unread from a message on (the message itself included); its mentions come back. */
	async unreadFrom(caller: IChatCaller & { employeeId: ID }, messageId: ID): Promise<{ events: IChatEvent[] }> {
		const message = await this.messageForCaller(caller, messageId);
		const member = await this.access.membership(message.conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		const patch = {
			readCount: await this.timelinePosition(caller.tenantId, message.conversationId, message, false),
			mentionCount: await this.countMentions(caller.tenantId, message.conversationId, caller.employeeId, message, true),
			lastReadMessageId: null
		};
		await this.dataSource.getRepository(ChatMember).update({ id: member.id }, patch as never);
		Object.assign(member, { ...patch, lastReadMessageId: undefined });
		return { events: [await this.realtime.publish(this.realtime.memberStateFact(member))] };
	}

	/** Marks every conversation of the caller read; answers an undo handle valid for a minute (on any replica). */
	async readAll(caller: IChatCaller & { employeeId: ID }): Promise<IChatReadAllResult & { events: IChatEvent[] }> {
		const members = await this.dataSource.getRepository(ChatMember).find({ where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() } });
		const conversations = members.length
			? await this.dataSource.getRepository(ChatConversation).find({ select: { id: true, messageCount: true }, where: { id: In(members.map((m) => m.conversationId)), tenantId: caller.tenantId } })
			: [];
		const counts = new Map(conversations.map((c) => [String(c.id), c.messageCount ?? 0]));
		const snapshot: ReadSnapshot = { v: 1, tenantId: caller.tenantId, userId: caller.userId, employeeId: caller.employeeId, at: Date.now(), rows: [], follows: [] };
		const events: IChatEvent[] = [];
		const now = new Date();
		let updated = 0;
		for (const member of members) {
			const total = counts.get(String(member.conversationId)) ?? 0;
			if ((member.readCount ?? 0) >= total && !(member.mentionCount > 0)) continue;
			snapshot.rows.push({ id: member.id as ID, readCount: member.readCount ?? 0, mentionCount: member.mentionCount ?? 0, lastReadMessageId: member.lastReadMessageId ?? null });
			const patch = { readCount: total, mentionCount: 0, lastReadAt: now };
			await this.dataSource.getRepository(ChatMember).update({ id: member.id }, patch);
			Object.assign(member, patch);
			events.push(await this.realtime.publish(this.realtime.memberStateFact(member)));
			updated += 1;
		}
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({
			where: { tenantId: caller.tenantId, employeeId: caller.employeeId },
			take: CHAT_MAX_PAGE_SIZE
		});
		for (const follow of follows) {
			if ((follow.unreadReplies ?? 0) <= 0) continue;
			snapshot.follows.push({
				id: follow.id as ID,
				unreadReplies: follow.unreadReplies ?? 0,
				lastReadReplyAt: follow.lastReadReplyAt ? new Date(follow.lastReadReplyAt).toISOString() : null
			});
		}
		await this.dataSource.getRepository(ChatThreadFollow).update({ tenantId: caller.tenantId, employeeId: caller.employeeId }, { unreadReplies: 0, lastReadReplyAt: now });
		void this.notifier.markAllRead({ tenantId: caller.tenantId, employeeId: caller.employeeId });
		return { updated, snapshotId: encodeSnapshot(snapshot), events };
	}

	/** Undoes a mark-all-read within its minute: the caller's own member rows and thread follows go back. */
	async restoreRead(caller: IChatCaller, handle: string): Promise<{ restored: number; events: IChatEvent[] }> {
		const snapshot = decodeSnapshot(handle);
		if (
			!snapshot ||
			String(snapshot.userId) !== String(caller.userId) ||
			String(snapshot.tenantId) !== String(caller.tenantId) ||
			!caller.employeeId ||
			String(snapshot.employeeId) !== String(caller.employeeId) ||
			Date.now() - snapshot.at > CHAT_READ_RESTORE_TTL_MS
		) {
			throw new NotFoundException('Nothing to undo.');
		}
		const repository = this.dataSource.getRepository(ChatMember);
		const events: IChatEvent[] = [];
		let restored = 0;
		for (const row of snapshot.rows) {
			const member = await repository.findOne({ where: { id: row.id, tenantId: caller.tenantId, employeeId: caller.employeeId } });
			if (!member) continue;
			const patch = { readCount: Math.max(0, Number(row.readCount) || 0), mentionCount: Math.max(0, Number(row.mentionCount) || 0), lastReadMessageId: row.lastReadMessageId ?? null };
			await repository.update({ id: member.id }, patch as never);
			Object.assign(member, { ...patch, lastReadMessageId: row.lastReadMessageId ?? undefined });
			events.push(await this.realtime.publish(this.realtime.memberStateFact(member)));
			restored += 1;
		}
		const follows = this.dataSource.getRepository(ChatThreadFollow);
		for (const row of snapshot.follows) {
			await follows.update(
				{ id: row.id, tenantId: caller.tenantId, employeeId: caller.employeeId },
				{ unreadReplies: Math.max(0, Number(row.unreadReplies) || 0), lastReadReplyAt: (row.lastReadReplyAt ? new Date(row.lastReadReplyAt) : null) as never }
			);
		}
		return { restored, events };
	}

	// ---------------------------------------------------------------- helpers

	/** A message the caller may read (a member of its conversation), or not found. */
	async messageForCaller(caller: IChatCaller, messageId: ID): Promise<ChatMessage> {
		return (await this.messageAndConversation(caller, messageId)).message;
	}

	/** A message and its conversation, when the caller is a member; not found otherwise. */
	private async messageAndConversation(caller: IChatCaller, messageId: ID): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
		const message = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, tenantId: caller.tenantId }, withDeleted: true });
		if (!message) throw new NotFoundException('The requested record was not found');
		const { conversation } = await this.access.requireMember(message.conversationId, caller);
		return { message, conversation };
	}

	/** A message the caller may change: a member of its conversation, and the conversation not archived. */
	private async messageForWrite(caller: IChatCaller, messageId: ID): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
		const found = await this.messageAndConversation(caller, messageId);
		if (found.conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		return found;
	}

	/** The caller's follows of the threads of a conversation (object criteria: every name quoted for the dialect). */
	private async followIdsIn(caller: IChatCaller & { employeeId: ID }, conversationId: ID): Promise<ID[]> {
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({
			select: { id: true, rootMessageId: true },
			where: { employeeId: caller.employeeId, tenantId: caller.tenantId }
		});
		if (!follows.length) return [];
		const roots = await this.dataSource.getRepository(ChatMessage).find({
			select: { id: true },
			where: { id: In(follows.map((follow) => follow.rootMessageId)), conversationId, tenantId: caller.tenantId },
			withDeleted: true
		});
		const rootIds = new Set(roots.map((root) => String(root.id)));
		return follows.filter((follow) => rootIds.has(String(follow.rootMessageId))).map((follow) => follow.id as ID);
	}

	/** The message the caller sent with a nonce, deleted or not. */
	private sentWithNonce(caller: IChatCaller, nonce: string): Promise<ChatMessage | null> {
		return this.dataSource.getRepository(ChatMessage).findOne({
			where: { authorUserId: caller.userId, nonce, tenantId: caller.tenantId },
			withDeleted: true
		});
	}

	/** The members of the conversation who follow a thread (a follower who left the conversation is not one). */
	private async activeFollowers(tenantId: ID, rootMessageId: ID, members: readonly ChatMember[]): Promise<ChatMember[]> {
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({ select: { employeeId: true }, where: { rootMessageId, tenantId } });
		const following = new Set(follows.map((follow) => String(follow.employeeId)));
		return members.filter((member) => following.has(String(member.employeeId)));
	}

	/**
	 * How many timeline messages from an anchor on (after it, or from it when `inclusive`) mention the employee —
	 * by name or through `@channel` / `@here` — so a partial read keeps the later badges.
	 */
	private async countMentions(tenantId: ID, conversationId: ID, employeeId: ID, anchor: ChatMessage, inclusive: boolean): Promise<number> {
		return this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
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
					where.where('message.createdAt > :anchorAt', { anchorAt: anchor.createdAt });
					where.orWhere(`message.createdAt = :anchorAt AND message.id ${inclusive ? '>=' : '>'} :anchorId`, { anchorAt: anchor.createdAt, anchorId: anchor.id });
				})
			)
			.andWhere(
				new Brackets((where) => {
					where.where('message.mentionsChannel = :yes', { yes: true });
					where.orWhere('message.mentionsHere = :yes', { yes: true });
					where.orWhere('message.mentionEmployeeIds LIKE :mention', { mention: `%"${String(employeeId)}"%` });
				})
			)
			.getCount();
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

	/**
	 * How many timeline messages come before a message — plus the message itself when `inclusive`. Deleted messages
	 * are left out, as `messageCount` leaves them out once deleted: the two stay on one scale.
	 */
	private async timelinePosition(tenantId: ID, conversationId: ID, anchor: ChatMessage, inclusive: boolean): Promise<number> {
		const count = await this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
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

}
