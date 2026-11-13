import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { assistedByOf } from '../chat-assisted';
import { Brackets, DataSource, EntityManager, In, IsNull, MoreThan, MoreThanOrEqual, Not, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
	ActorTypeEnum,
	CHAT_EVENT_NAMES,
	CHAT_MESSAGE_MAX_ATTACHMENTS,
	CHAT_MESSAGE_MAX_LENGTH,
	ChatMessageKindEnum,
	ChatTaskReferenceKindEnum,
	DocumentKindEnum,
	IChatCreateTaskInput,
	IChatCreateTaskResult,
	IChatEvent,
	IChatFilesQuery,
	IChatFilesResult,
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
	ITask,
	ITaskCreateInput,
	PermissionsEnum,
	ReactionEntityEnum,
	IChatThreadReadResult,
	BaseEntityEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { Reaction, RequestContext, TaskCreateCommand, TaskService } from '@gauzy/core';
import { chatFileOf, chatSqlDialectOf, ChatSqlDialect, IChatFileDocument, IChatFileLink, jsonListHasColumn, linkMetadataOf } from '../chat-files';
import { mentionedEmployees, parseMentions } from '../chat-mentions';
import { taskDescriptionOf, taskMentionsIn, taskTitleOf } from '../chat-task-references';
import { taskTeamsOf } from '../chat-task-team';
import { CHAT_MAX_PAGE_SIZE, CHAT_PAGE_SIZE, CHAT_READ_RESTORE_TTL_MS } from '../chat.constants';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatTaskReference } from '../entities/chat-task-reference.entity';
import { ChatThreadFollow } from '../entities/chat-thread-follow.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { inWriteTransaction } from '../realtime/chat-write-transaction';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatDraftUploadService } from './chat-draft-upload.service';
import { ChatNotifierService } from './chat-notifier.service';
import { blocksOf } from '../webhooks/chat-webhook-payload';

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

/** The longest name `attachmentNames` keeps of one file (a longer one is cut, with `…`). */
export const CHAT_ATTACHMENT_NAME_MAX = 255;

/**
 * The most characters `attachmentNames` holds: every name of the most files a message carries, each at its longest,
 * one per line — so no name is ever left out (a file-only message is found by any of its names).
 */
export const CHAT_ATTACHMENT_NAMES_MAX = CHAT_MESSAGE_MAX_ATTACHMENTS * (CHAT_ATTACHMENT_NAME_MAX + 1);

/**
 * The names of a message's files in the order attached, one per line, each on one line and cut to 255 characters;
 * null when there are none. A file without a name of its own is `file`.
 */
export function attachmentNamesOf(
	documentIds: readonly ID[],
	documents: ReadonlyArray<{ id: ID; name?: string | null; originalFilename?: string | null }>
): string | null {
	if (!documentIds.length) return null;
	const byId = new Map(documents.map((document) => [String(document.id), document]));
	const names = documentIds.map((id) => {
		const document = byId.get(String(id));
		const name = ((document?.name ?? '').trim() || (document?.originalFilename ?? '').trim() || 'file').replace(/[\r\n]+/g, ' ');
		return name.length > CHAT_ATTACHMENT_NAME_MAX ? `${name.slice(0, CHAT_ATTACHMENT_NAME_MAX - 1)}…` : name;
	});
	// Whole names only: a list longer than a message may carry (never, past the attachment check) keeps the first ones.
	const kept: string[] = [];
	let length = 0;
	for (const name of names) {
		if (length + name.length + (kept.length ? 1 : 0) > CHAT_ATTACHMENT_NAMES_MAX) break;
		length += name.length + (kept.length ? 1 : 0);
		kept.push(name);
	}
	return kept.join('\n');
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
		private readonly notifier: ChatNotifierService,
		private readonly tasks: TaskService,
		private readonly commandBus: CommandBus,
		private readonly drafts: ChatDraftUploadService
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

	/**
	 * Marks a thread read for the caller: a followed thread's unread replies go to zero, and the inbox notifications
	 * about its replies are read whether or not the caller still follows it (someone who unfollowed after a reply
	 * notified them would otherwise keep that notification unread for good, since reading the conversation leaves
	 * thread-only replies to the thread). The conversation's own unread state is untouched; a root the caller may not
	 * read changes nothing (`messageForCaller` refuses it).
	 */
	async markThreadRead(caller: IChatCaller, rootMessageId: ID): Promise<IChatThreadReadResult> {
		if (!caller.employeeId) return { updated: false };
		const root = await this.messageForCaller(caller, rootMessageId);
		const result = await this.dataSource
			.getRepository(ChatThreadFollow)
			.update({ rootMessageId: root.id as ID, employeeId: caller.employeeId, tenantId: caller.tenantId }, { unreadReplies: 0, lastReadReplyAt: new Date() });
		const updated = (result.affected ?? 0) > 0;
		void this.notifier.markThreadRead(root.id as ID, { tenantId: caller.tenantId, employeeId: caller.employeeId });
		return { updated };
	}

	// ---------------------------------------------------------------- send / edit / delete

	async send(caller: IChatCaller & { employeeId: ID }, conversationId: ID, input: IChatMessageCreateInput): Promise<IChatSendResult> {
		const { conversation, member } = await this.access.requireMember(conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		const attachmentIds = this.validAttachments(input.attachmentIds);
		// A message of files only has no text: the body may be empty when it carries an attachment.
		const body = this.validBody(input.body, attachmentIds.length > 0);

		// The same send twice (a retry, however late, the message since deleted or not) answers the same message, so
		// the unique (author, nonce) key never refuses a retry — before the files are checked: a file deleted since
		// the first send is no reason to refuse the retry of a send that went through.
		if (input.nonce) {
			const existing = await this.sentWithNonce(caller, input.nonce);
			if (existing) {
				const [message] = await this.withRelations(caller, [existing]);
				return { message, events: [] };
			}
		}
		const attachmentNames = await this.requireOwnFiles(caller, attachmentIds);

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
		// The tasks the body refers to (typed `KEY-number`, linked by id), resolved now and recorded with the message.
		const mentionedTasks = await this.mentionedTaskIds(caller, conversation, body, input.taskId ? [input.taskId] : []);

		const members = await this.access.members(caller.tenantId, conversationId);
		const mentioned = mentionedEmployees(body, input.mentionEmployeeIds, members.map((m) => m.employeeId), caller.employeeId);
		const parsed = parseMentions(body);
		const broadcast = parsed.channel || parsed.here;
		const timeline = !root || !!input.alsoInConversation;
		const now = new Date();

		let message: ChatMessage;
		let followers: ChatMember[];
		let events: IChatEvent[];
		try {
			const written = await inWriteTransaction(this.dataSource, async (manager) => {
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
						attachmentNames,
						nonce: input.nonce ?? null,
						// Shown beside the message: the person wrote it with an assistant. Never changed by an edit.
						assistedBy: assistedByOf(input.assistedBy),
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
				for (const taskId of mentionedTasks) {
					await manager.getRepository(ChatTaskReference).save(
						manager.getRepository(ChatTaskReference).create({
							messageId: created.id as ID,
							taskId,
							kind: ChatTaskReferenceKindEnum.MENTION,
							tenantId: caller.tenantId,
							organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
						})
					);
				}
				// The files are a message's now, no longer drafts the sweep would take: held until the commit, and refused
				// when a discard or the sweep removed one first. Before the links, whose keys would otherwise fail on it.
				await this.drafts.consume(manager, caller.tenantId, attachmentIds);
				await this.linkAttachments(manager, caller, conversation, created.id as ID, attachmentIds, false);
				// The facts commit with the message: the message itself, the thread's new reply count (to the followers of
				// the thread who are members), and the sender's own read position. Every other member's counters follow
				// after the commit (see below).
				const threadFollowers = root ? await this.activeFollowers(caller.tenantId, root.id as ID, members, manager) : [];
				const facts: IChatEvent[] = [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_CREATED, created, members.map((m) => m.userId)))];
				if (root) {
					facts.push(
						await this.realtime.append(manager, this.realtime.threadFact({ ...root, replyCount: (root.replyCount ?? 0) + 1 }, threadFollowers.map((follower) => follower.userId)))
					);
				}
				if (timeline) {
					facts.push(await this.realtime.append(manager, this.realtime.memberStateFact({ ...member, readCount: count, lastReadMessageId: created.id as ID })));
				}
				return { created, threadFollowers, facts };
			});
			message = written.created;
			followers = written.threadFollowers;
			events = written.facts;
		} catch (error) {
			// A retry that raced its first attempt: the unique (author, nonce) key refused the second row, and the
			// first is the answer.
			const existing = input.nonce ? await this.sentWithNonce(caller, input.nonce) : null;
			if (!existing) throw error;
			const [answer] = await this.withRelations(caller, [existing]);
			return { message: answer, events: [] };
		}

		// Notifications after the write (best effort). The followers of a thread hear of a reply only while they are
		// members of the conversation, and by their notify level.
		this.notifier.notifyMentions(message, conversation, mentioned);
		if (root) {
			this.notifier.notifyThread(message, conversation, followers, mentioned);
		} else {
			this.notifier.notifyDirect(message, conversation, members, mentioned);
		}
		if (timeline) {
			// Every other member's state reaches them on their own addressed stream, nobody else's (the sender's own is in
			// the answer). After the commit and best effort: one row per member would hold the conversation's row lock
			// for as long as they take to write, and the message's own fact already reached every member.
			for (const m of members) {
				if (String(m.id) === String(member.id)) continue;
				await this.realtime.publish(
					this.realtime.memberStateFact({ ...m, mentionCount: (m.mentionCount ?? 0) + (broadcast || mentioned.includes(String(m.employeeId)) ? 1 : 0) })
				);
			}
		}
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	async edit(caller: IChatCaller, messageId: ID, input: IChatMessageUpdateInput): Promise<IChatSendResult> {
		const { message, conversation } = await this.messageForWrite(caller, messageId);
		if (String(message.authorUserId ?? '') !== String(caller.userId)) throw new ForbiddenException('Only the author can edit a message.');
		if (message.deletedAt) throw new BadRequestException('A deleted message cannot be edited.');
		const attachments = input.attachmentIds ? this.validAttachments(input.attachmentIds) : null;
		// The text may go when the message keeps (or now carries) a file.
		const body = this.validBody(input.body, (attachments ?? idsOf(message.attachmentIds)).length > 0);
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
		if (attachments) {
			message.attachmentNames = await this.requireOwnFiles(caller, attachments);
			message.attachmentIds = attachments.length ? JSON.stringify(attachments) : null;
		}
		message.editedAt = new Date();
		// The body, its attachments and its task references change together: the references are resolved first, then
		// written with the body and the attachment links in one transaction, whose row lock makes a second edit wait — a
		// message never shows one edit's text with another's attachments or task cards, and an edit is never half done.
		const taskMentions = await this.mentionedTaskIds(caller, conversation, body, await this.keptTaskReferences(caller, message));
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			await manager.getRepository(ChatMessage).save(message);
			if (attachments) {
				await this.drafts.consume(manager, caller.tenantId, attachments);
				await this.linkAttachments(manager, caller, conversation, message.id as ID, attachments, true);
			}
			await this.writeTaskMentions(manager, caller, conversation, message, taskMentions);
			return [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		});
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
		const events = await inWriteTransaction(this.dataSource, async (manager): Promise<IChatEvent[] | null> => {
			// Only a message still there is deleted, and only the request that deleted it moves the counters: two deletes
			// of the same message can both pass the check above, and the second would take the conversation's count and
			// the members' read positions down a second time (unread badges too low). Its UPDATE waits for the first's row
			// lock, then matches no row.
			const result = await manager.getRepository(ChatMessage).update({ id: message.id, deletedAt: IsNull() }, {
				// A thread root keeps its row as a tombstone; a plain message is withdrawn.
				body: '',
				attachmentIds: null,
				attachmentNames: null,
				mentionEmployeeIds: null,
				// An app message's layout goes with its text (a deleted thread root stays as a tombstone).
				blocks: null,
				deletedAt: new Date()
			} as never);
			if (!(result.affected ?? 0)) return null;
			await manager.getRepository<ObjectLiteral>('DocumentLink').delete({ entity: BaseEntityEnum.ChatMessage, entityId: message.id, tenantId: caller.tenantId } as never);
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
				// A member who had read the deleted message (position or past it) has read one message fewer now; then
				// nobody's position may exceed the new total.
				await manager.getRepository(ChatMember).decrement({ conversationId: conversation.id as ID, readCount: MoreThanOrEqual(position) }, 'readCount', 1);
				await manager.getRepository(ChatMember).update({ conversationId: conversation.id as ID, readCount: MoreThan(total) }, { readCount: total });
				for (const m of members) {
					if ((m.readCount ?? 0) >= position || (m.mentionCount ?? 0) <= 0) continue;
					if (broadcast || mentionedBefore.includes(String(m.employeeId))) {
						await manager.getRepository(ChatMember).decrement({ id: m.id }, 'mentionCount', 1);
					}
				}
			}
			return [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_DELETED, message, members.map((m) => m.userId)))];
		});
		// Deleted by a concurrent request: that one moved the counters and told the members.
		return { events: events ?? [] };
	}

	async pin(caller: IChatCaller, messageId: ID, pinned: boolean): Promise<IChatSendResult> {
		const { message } = await this.messageForWrite(caller, messageId);
		if (pinned && message.deletedAt) throw new BadRequestException('A deleted message cannot be pinned.');
		const pinnedAt = pinned ? (message.pinnedAt ?? new Date()) : null;
		const pinnedByEmployeeId = pinned ? (caller.employeeId ?? null) : null;
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			// Unpinning writes NULL: `save` would leave an undefined member untouched.
			await manager.getRepository(ChatMessage).update({ id: message.id }, { pinnedAt, pinnedByEmployeeId } as never);
			return [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		});
		message.pinnedAt = pinnedAt ?? undefined;
		message.pinnedByEmployeeId = pinnedByEmployeeId ?? undefined;
		const [withRelations] = await this.withRelations(caller, [message]);
		return { message: withRelations, events };
	}

	// ---------------------------------------------------------------- reactions

	async react(caller: IChatCaller & { employeeId: ID }, messageId: ID, emoji: string, add: boolean): Promise<IChatSendResult> {
		const { message } = await this.messageForWrite(caller, messageId);
		if (add && message.deletedAt) throw new BadRequestException('A deleted message cannot be reacted to.');
		const value = (emoji ?? '').trim();
		if (!value || value.length > 32) throw new BadRequestException('State an emoji.');
		const where = { entity: ReactionEntityEnum.ChatMessage, entityId: message.id as ID, emoji: value, employeeId: caller.employeeId, tenantId: caller.tenantId };
		const members = await this.access.members(caller.tenantId, message.conversationId);
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			const repository = manager.getRepository(Reaction);
			const existing = await repository.findOne({ where });
			if (add && !existing) {
				await repository.save(
					repository.create({ ...where, actorType: ActorTypeEnum.User, organizationId: message.organizationId ?? caller.organizationId ?? undefined } as never)
				);
			} else if (!add && existing) {
				await repository.remove(existing);
			}
			return [await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, members.map((m) => m.userId)))];
		});
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
		Object.assign(member, { ...patch, lastReadMessageId: lastReadMessageId ?? undefined });
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			// The read columns only: a preference or a counter written since the row was read is not written back.
			await manager.getRepository(ChatMember).update({ id: member.id }, patch as never);
			return [await this.realtime.append(manager, this.realtime.memberStateFact(member))];
		});
		// Reading everything reads the replies of the followed threads that were also sent to the conversation; a reply
		// that lives in its thread only stays unread until the thread is read (as its notification does).
		if (!messageId) await this.readFollowedRepliesIn(caller, conversationId);
		void this.notifier.markConversationRead(conversationId, { tenantId: caller.tenantId, employeeId: caller.employeeId }, anchor);
		return { events };
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
		Object.assign(member, { ...patch, lastReadMessageId: undefined });
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			await manager.getRepository(ChatMember).update({ id: member.id }, patch as never);
			return [await this.realtime.append(manager, this.realtime.memberStateFact(member))];
		});
		return { events };
	}

	/** Marks every conversation of the caller read; answers an undo handle valid for a minute (on any replica). */
	async readAll(caller: IChatCaller & { employeeId: ID }): Promise<IChatReadAllResult & { events: IChatEvent[] }> {
		const members = await this.dataSource.getRepository(ChatMember).find({ where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() } });
		const conversations = members.length
			? await this.dataSource.getRepository(ChatConversation).find({ select: { id: true, messageCount: true }, where: { id: In(members.map((m) => m.conversationId)), tenantId: caller.tenantId } })
			: [];
		const counts = new Map(conversations.map((c) => [String(c.id), c.messageCount ?? 0]));
		const snapshot: ReadSnapshot = { v: 1, tenantId: caller.tenantId, userId: caller.userId, employeeId: caller.employeeId, at: Date.now(), rows: [], follows: [] };
		const now = new Date();
		// Every conversation's read state and its fact commit together: all read, or none.
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			const facts: IChatEvent[] = [];
			for (const member of members) {
				const total = counts.get(String(member.conversationId)) ?? 0;
				if ((member.readCount ?? 0) >= total && !(member.mentionCount > 0)) continue;
				snapshot.rows.push({ id: member.id as ID, readCount: member.readCount ?? 0, mentionCount: member.mentionCount ?? 0, lastReadMessageId: member.lastReadMessageId ?? null });
				const patch = { readCount: total, mentionCount: 0, lastReadAt: now };
				await manager.getRepository(ChatMember).update({ id: member.id }, patch);
				Object.assign(member, patch);
				facts.push(await this.realtime.append(manager, this.realtime.memberStateFact(member)));
			}
			return facts;
		});
		const updated = events.length;
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
		const employeeId: ID = caller.employeeId;
		const events = await inWriteTransaction(this.dataSource, async (manager) => {
			const repository = manager.getRepository(ChatMember);
			const facts: IChatEvent[] = [];
			for (const row of snapshot.rows) {
				const member = await repository.findOne({ where: { id: row.id, tenantId: caller.tenantId, employeeId } });
				if (!member) continue;
				const patch = { readCount: Math.max(0, Number(row.readCount) || 0), mentionCount: Math.max(0, Number(row.mentionCount) || 0), lastReadMessageId: row.lastReadMessageId ?? null };
				await repository.update({ id: member.id }, patch as never);
				Object.assign(member, { ...patch, lastReadMessageId: row.lastReadMessageId ?? undefined });
				facts.push(await this.realtime.append(manager, this.realtime.memberStateFact(member)));
			}
			return facts;
		});
		const restored = events.length;
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
	// ---------------------------------------------------------------- files

	/**
	 * The files of a conversation: every document a message of it carries, newest first, with the message and its
	 * author — read from the document links the sends wrote, so the pane is the same list the Docs plugin shows on
	 * the documents' side. A link counts only when the message itself names the document (`attachmentIds`): a link
	 * written any other way is not an attachment and cannot put a file under another member's name. A document that
	 * is gone, or a message deleted since, is not a file any more, and takes no place on the page.
	 */
	async files(caller: IChatCaller, conversationId: ID, query: IChatFilesQuery = {}): Promise<IChatFilesResult> {
		await this.access.requireMember(conversationId, caller);
		const limit = Math.min(Math.max(Number(query.limit) || CHAT_PAGE_SIZE, 1), CHAT_MAX_PAGE_SIZE);
		const skip = Math.max(Number(query.skip) || 0, 0);
		const rows = (await this.dataSource
			.getRepository<ObjectLiteral>('DocumentLink')
			.createQueryBuilder('link')
			.innerJoin(
				ChatMessage,
				'message',
				`message.id = link.entityId AND message.conversationId = :conversationId AND message.deletedAt IS NULL AND ${jsonListHasColumn('message.attachmentIds', 'link.documentId', this.dialect())}`,
				{ conversationId }
			)
			.innerJoin('Document', 'document', 'document.id = link.documentId AND document.tenantId = link.tenantId AND document.deletedAt IS NULL')
			.where('link.entity = :entity', { entity: BaseEntityEnum.ChatMessage })
			.andWhere('link.tenantId = :tenantId', { tenantId: caller.tenantId })
			.select('link.documentId', 'documentId')
			.addSelect('link.entityId', 'messageId')
			.addSelect('link.createdAt', 'attachedAt')
			.addSelect('message.authorEmployeeId', 'authorEmployeeId')
			.addSelect('message.authorUserId', 'authorUserId')
			.orderBy('link.createdAt', 'DESC')
			.addOrderBy('link.id', 'DESC')
			.offset(skip)
			.limit(limit + 1)
			.getRawMany()) as Array<Omit<IChatFileLink, 'conversationId'>>;
		const page = rows.slice(0, limit);
		const documentIds = [...new Set(page.map((row) => String(row.documentId)))];
		const documents = documentIds.length
			? ((await this.dataSource.getRepository<ObjectLiteral>('Document').find({
					select: { id: true, name: true, originalFilename: true, mimeType: true, fileSize: true, status: true, storageProvider: true, storageKey: true, thumbKey: true, metadata: true },
					where: { id: In(documentIds), tenantId: caller.tenantId }
			  } as never)) as IChatFileDocument[])
			: [];
		const byId = new Map(documents.map((document) => [String(document.id), document]));
		const files = page.map((row) => chatFileOf({ ...row, conversationId }, byId.get(String(row.documentId)))).filter((file): file is NonNullable<typeof file> => !!file);
		return { files, hasMore: rows.length > limit };
	}

	/**
	 * Every attachment must be a file the caller uploaded (kind FILE, created by the caller's user) in the tenant.
	 *
	 * @returns The files' names in the order attached, one per line (what a message of files only reads as), or null
	 * without attachments.
	 */
	private async requireOwnFiles(caller: IChatCaller, documentIds: readonly ID[]): Promise<string | null> {
		if (!documentIds.length) return null;
		const rows = (await this.dataSource.getRepository<ObjectLiteral>('Document').find({
			select: { id: true, name: true, originalFilename: true },
			where: { id: In([...documentIds]), tenantId: caller.tenantId, kind: DocumentKindEnum.FILE, createdByUserId: caller.userId }
		} as never)) as Array<{ id: ID; name?: string | null; originalFilename?: string | null }>;
		if (rows.length !== documentIds.length) throw new BadRequestException('Every attachment must be a file you uploaded.');
		return attachmentNamesOf(documentIds, rows);
	}

	/**
	 * The document links that make a message's attachments visible on the documents' side (and the files pane): one
	 * per attachment; with `replace`, the links of attachments the message no longer carries go.
	 */
	private async linkAttachments(manager: EntityManager, caller: IChatCaller, conversation: ChatConversation, messageId: ID, documentIds: readonly ID[], replace: boolean): Promise<void> {
		const links = manager.getRepository<ObjectLiteral>('DocumentLink');
		const wanted = new Set(documentIds.map(String));
		const existing = (await links.find({ select: { id: true, documentId: true }, where: { entity: BaseEntityEnum.ChatMessage, entityId: messageId, tenantId: caller.tenantId } } as never)) as Array<{ id: ID; documentId: ID }>;
		const linked = new Set(existing.map((row) => String(row.documentId)));
		if (replace) {
			const gone = existing.filter((row) => !wanted.has(String(row.documentId))).map((row) => row.id);
			if (gone.length) await links.delete({ id: In(gone) } as never);
		}
		for (const documentId of wanted) {
			if (linked.has(documentId)) continue;
			await links.save(
				links.create({
					documentId,
					entity: BaseEntityEnum.ChatMessage,
					entityId: messageId,
					metadata: linkMetadataOf(conversation.id as ID, this.dialect()),
					tenantId: caller.tenantId,
					organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
				} as never)
			);
		}
	}

	// ---------------------------------------------------------------- tasks

	/**
	 * Creates a task from a message — its title the message's first line unless one is given, its description the
	 * body, the assignees given (the caller is added by the platform) — and records the message's reference to it
	 * (kind `created`). The caller must be able to add tasks (`ORG_TASK_ADD`) and a member of the conversation; the
	 * project, when named, must be the organization's.
	 */
	async createTask(caller: IChatCaller, messageId: ID, input: IChatCreateTaskInput): Promise<IChatCreateTaskResult> {
		if (!RequestContext.hasPermission(PermissionsEnum.ORG_TASK_ADD)) throw new ForbiddenException('Creating a task needs the ORG_TASK_ADD permission.');
		const { message, conversation } = await this.messageForWrite(caller, messageId);
		if (message.deletedAt) throw new BadRequestException('A deleted message cannot become a task.');
		const organizationId = (conversation.organizationId ?? caller.organizationId) as ID | null;
		if (!organizationId) throw new BadRequestException('A task needs an organization.');
		if (input.projectId) {
			const project = await this.dataSource
				.getRepository<ObjectLiteral>('OrganizationProject')
				.findOne({ select: { id: true }, where: { id: input.projectId, tenantId: caller.tenantId, organizationId } } as never);
			if (!project) throw new NotFoundException('The project was not found');
		}
		// A team outside the caller's tenant or the conversation's organization is refused here, before the task exists.
		const teams = await taskTeamsOf(
			(where) => this.dataSource.getRepository<ObjectLiteral>('OrganizationTeam').findOne({ select: { id: true }, where } as never) as Promise<{ id: ID } | null>,
			{ tenantId: caller.tenantId, organizationId },
			input.organizationTeamId
		);
		const title = (input.title ?? '').trim() || taskTitleOf(message.body);
		if (!title) throw new BadRequestException('The message has no text to title the task with.');
		const members = await this.assignees(caller.tenantId, organizationId, input.assigneeEmployeeIds ?? []);
		const task: ITask = await this.commandBus.execute(
			new TaskCreateCommand({
				tenantId: caller.tenantId,
				organizationId,
				projectId: input.projectId ?? null,
				// The team's lists show the task (the clients read a team's tasks through this relation).
				teams,
				title,
				description: taskDescriptionOf(message.body),
				status: TaskStatusEnum.OPEN,
				members
			} as unknown as ITaskCreateInput)
		);
		const conversationMembers = await this.access.members(caller.tenantId, message.conversationId);
		let saved: ChatTaskReference;
		let events: IChatEvent[];
		try {
			// The reference and its fact commit together.
			const written = await inWriteTransaction(this.dataSource, async (manager) => {
				const repository = manager.getRepository(ChatTaskReference);
				const reference = await repository.save(
					repository.create({ messageId: message.id as ID, taskId: task.id as ID, kind: ChatTaskReferenceKindEnum.CREATED, tenantId: caller.tenantId, organizationId })
				);
				const facts: IChatEvent[] = [
					await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, conversationMembers.map((m) => m.userId)))
				];
				return { reference, facts };
			});
			saved = written.reference;
			events = written.facts;
		} catch (error) {
			// The task exists (its own transaction committed) but the message does not point to it: said with the task's
			// id, so the person links it by hand rather than creating it again.
			this.logger.error(`Task ${task.id} was created from message ${message.id}, but the reference could not be saved: ${error instanceof Error ? error.message : String(error)}`);
			throw new InternalServerErrorException({ message: `The task was created (${task.id}) but the message could not be linked to it; link it by hand rather than creating it again`, taskId: task.id });
		}
		return { task, reference: { messageId: saved.messageId, taskId: saved.taskId, kind: saved.kind }, events };
	}

	/** The assignees named, each an employee of the organization (an unknown one is refused, not dropped). */
	private async assignees(tenantId: ID, organizationId: ID, employeeIds: readonly ID[]): Promise<Array<{ id: ID }>> {
		const ids = [...new Set(employeeIds.map(String))];
		if (!ids.length) return [];
		const rows = await this.dataSource
			.getRepository<ObjectLiteral>('Employee')
			.find({ select: { id: true }, where: { id: In(ids), tenantId, organizationId } } as never);
		if (rows.length !== ids.length) throw new NotFoundException('An assignee is not an employee of the organization');
		return ids.map((id) => ({ id: id as ID }));
	}

	/**
	 * The tasks a body refers to, resolved: a typed `KEY-number` through the platform's reference resolver (the
	 * project's key, its former keys, the key derived from its name; an ambiguous one is left out), a linked id when
	 * the task is the tenant's (and the conversation's organization's, when it has one). Those in `except` (a card
	 * sent with the message) are not repeated. Never throws: a resolver that failed leaves the typed ones out.
	 */
	private async mentionedTaskIds(caller: IChatCaller, conversation: ChatConversation, body: string, except: readonly ID[]): Promise<ID[]> {
		const mentions = taskMentionsIn(body);
		const ids = new Set<string>();
		if (mentions.typed.length) {
			const organizationId = conversation.organizationId ?? caller.organizationId ?? undefined;
			const resolutions = await this.tasks
				.resolveReferences({ tenantId: caller.tenantId, organizationId, references: mentions.typed } as never)
				.catch((error: unknown) => {
					this.logger.warn(`The task references of a message could not be resolved: ${error instanceof Error ? error.message : String(error)}`);
					return [];
				});
			for (const resolution of resolutions) if (resolution.resolved && resolution.taskId) ids.add(String(resolution.taskId));
		}
		if (mentions.linked.length) {
			const rows = await this.dataSource.getRepository<ObjectLiteral>('Task').find({
				select: { id: true },
				where: { id: In(mentions.linked), tenantId: caller.tenantId, ...(conversation.organizationId ? { organizationId: conversation.organizationId } : {}) }
			} as never);
			for (const row of rows) ids.add(String(row['id']));
		}
		for (const id of except) ids.delete(String(id));
		return [...ids] as ID[];
	}

	/** The tasks a message refers to other than by its text (a card sent with it, a task created from it): an edit keeps them. */
	private async keptTaskReferences(caller: IChatCaller, message: ChatMessage): Promise<ID[]> {
		const kept = await this.dataSource
			.getRepository(ChatTaskReference)
			.find({ where: { messageId: message.id as ID, tenantId: caller.tenantId, kind: Not(ChatTaskReferenceKindEnum.MENTION) } });
		return kept.map((reference) => reference.taskId);
	}

	/** After an edit, in its transaction: the message's `mention` references follow its new body. */
	private async writeTaskMentions(manager: EntityManager, caller: IChatCaller, conversation: ChatConversation, message: ChatMessage, wanted: readonly ID[]): Promise<void> {
		const repository = manager.getRepository(ChatTaskReference);
		await repository.delete({ messageId: message.id as ID, tenantId: caller.tenantId, kind: ChatTaskReferenceKindEnum.MENTION });
		for (const taskId of wanted) {
			await repository.save(
				repository.create({
					messageId: message.id as ID,
					taskId,
					kind: ChatTaskReferenceKindEnum.MENTION,
					tenantId: caller.tenantId,
					organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
				})
			);
		}
	}

	/** The connection's dialect, for what the query builder cannot write portably (see `chat-files.ts`). */
	private dialect(): ChatSqlDialect {
		return chatSqlDialectOf(String(this.dataSource.options?.type));
	}

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
	/**
	 * A full read of a conversation, for the threads the caller follows in it: of a follow's unread replies, only the
	 * ones that live in the thread only (not also sent to the conversation) stay unread — the others were just read in
	 * the conversation. Thread-only replies are counted from the follow's read mark (`lastReadReplyAt`, which a new
	 * follow starts with, see `follow`), and the mark does not move (the thread itself was not read). The counter only
	 * goes down, by a compare-and-set on the value read: a reply counted meanwhile, or another read of the same follow
	 * (a second tab) that got there first, makes the write miss, and the follow is read and counted again — so two reads
	 * never both subtract, and a reply arriving meanwhile still counts.
	 */
	private async readFollowedRepliesIn(caller: IChatCaller & { employeeId: ID }, conversationId: ID): Promise<void> {
		const followIds = await this.followIdsIn(caller, conversationId);
		if (!followIds.length) return;
		const follows = this.dataSource.getRepository(ChatThreadFollow);
		const select = { id: true, rootMessageId: true, unreadReplies: true, lastReadReplyAt: true } as const;
		const unreadFollows = await follows.find({ select, where: { id: In(followIds), tenantId: caller.tenantId, unreadReplies: MoreThan(0) } });
		for (const unreadFollow of unreadFollows) {
			let follow: ChatThreadFollow | null = unreadFollow;
			for (let attempt = 0; attempt < 3 && follow && (follow.unreadReplies ?? 0) > 0; attempt += 1) {
				const unread = follow.unreadReplies ?? 0;
				const stillUnread = Math.min(unread, await this.threadOnlyRepliesSince(caller, follow));
				if (stillUnread >= unread) break;
				const written = await follows.update({ id: follow.id as ID, tenantId: caller.tenantId, unreadReplies: unread }, { unreadReplies: stillUnread });
				if ((written.affected ?? 0) > 0) break;
				follow = await follows.findOne({ select, where: { id: follow.id as ID, tenantId: caller.tenantId } });
			}
		}
	}

	/** The replies to a followed thread that live in the thread only, by others, since the follow's read mark. */
	private async threadOnlyRepliesSince(caller: IChatCaller & { employeeId: ID }, follow: Pick<ChatThreadFollow, 'rootMessageId' | 'lastReadReplyAt'>): Promise<number> {
		const replies = this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('reply')
			.where('reply.threadRootId = :rootMessageId', { rootMessageId: follow.rootMessageId })
			.andWhere('reply.tenantId = :tenantId', { tenantId: caller.tenantId })
			.andWhere(
				new Brackets((place) => {
					place.where('reply.alsoInConversation IS NULL').orWhere('reply.alsoInConversation = :alsoInConversation', { alsoInConversation: false });
				})
			)
			.andWhere(
				new Brackets((by) => {
					by.where('reply.authorEmployeeId IS NULL').orWhere('reply.authorEmployeeId != :employeeId', { employeeId: caller.employeeId });
				})
			);
		if (follow.lastReadReplyAt) replies.andWhere('reply.createdAt > :since', { since: follow.lastReadReplyAt });
		return replies.getCount();
	}

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
	private async activeFollowers(tenantId: ID, rootMessageId: ID, members: readonly ChatMember[], manager?: EntityManager): Promise<ChatMember[]> {
		const follows = await (manager ?? this.dataSource).getRepository(ChatThreadFollow).find({ select: { employeeId: true }, where: { rootMessageId, tenantId } });
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
			// An app message's layout, parsed from its JSON column (none for a member's message).
			blocks: row.blocks && !row.deletedAt ? blocksOf(row.blocks) : null,
			reactions: [...(reactionsOf.get(String(row.id))?.values() ?? [])],
			taskReferences: referencesOf.get(String(row.id)) ?? [],
			following: followed.has(String(row.id))
		}));
	}

	private validBody(body: string | undefined, hasAttachments = false): string {
		const value = (body ?? '').replace(/\r\n/g, '\n').trim();
		if (!value && !hasAttachments) throw new BadRequestException('A message needs a body or an attachment.');
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

	/**
	 * Follows a thread for an employee (upsert); a new follow starts with nothing unread when `read` is true, and
	 * otherwise counts the replies from this one on (its read mark is the thread's previous reply, or the root).
	 */
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
				// A follow that starts unread (the root author's, when someone replies) starts after the replies before this
				// one: those were never counted on it, so reading the conversation must not count them as still unread.
				lastReadReplyAt: read ? new Date() : (root.lastReplyAt ?? root.createdAt ?? undefined),
				tenantId: who.tenantId,
				organizationId: root.organizationId ?? who.organizationId ?? undefined
			})
		);
	}

}
