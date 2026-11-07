import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Not } from 'typeorm';
import {
	CHAT_DEFAULT_CHANNEL_NAME,
	CHAT_GROUP_MAX_MEMBERS,
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatNotifyLevelEnum,
	ChatVisibilityEnum,
	IChatCategory,
	IChatCategoryInput,
	IChatConversationCreateInput,
	IChatConversationList,
	IChatConversationUpdateInput,
	IChatConversationWithState,
	IChatEvent,
	IChatMemberState,
	IChatMemberStateInput,
	IChatMemberSummary,
	IChatStates,
	ID,
	IChatPerson
} from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { directKeyOf } from '../chat-direct-key';
import { CHAT_MAX_STATES, CHAT_PEOPLE_MAX } from '../chat.constants';
import { ChatCategory } from '../entities/chat-category.entity';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatThreadFollow } from '../entities/chat-thread-follow.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';

/** The caller's state of a conversation, from their member row and the conversation's counter. */
export function memberState(member: ChatMember, conversation: Pick<ChatConversation, 'messageCount'>): IChatMemberState {
	return {
		conversationId: member.conversationId,
		role: member.role,
		notifyLevel: member.notifyLevel,
		isFavorite: !!member.isFavorite,
		unreadCount: Math.max(0, (conversation.messageCount ?? 0) - (member.readCount ?? 0)),
		mentionCount: Math.max(0, member.mentionCount ?? 0),
		lastReadMessageId: member.lastReadMessageId ?? null,
		lastReadAt: member.lastReadAt ?? null
	};
}

/**
 * Conversations: categories, channels, direct and group conversations, memberships and the caller's state.
 * Every read answers the caller's conversations only; every write checks the caller's role.
 */
@Injectable()
export class ChatConversationService {
	private readonly logger = new Logger(ChatConversationService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly realtime: ChatRealtime
	) {}

	// ---------------------------------------------------------------- categories

	async listCategories(caller: IChatCaller): Promise<IChatCategory[]> {
		return this.dataSource.getRepository(ChatCategory).find({
			where: { tenantId: caller.tenantId, ...(caller.organizationId ? { organizationId: caller.organizationId } : {}) },
			order: { position: 'ASC', name: 'ASC' }
		}) as Promise<IChatCategory[]>;
	}

	async createCategory(caller: IChatCaller, input: IChatCategoryInput): Promise<IChatCategory> {
		this.requireManage(caller);
		const repository = this.dataSource.getRepository(ChatCategory);
		const position = input.position ?? (await repository.count({ where: { tenantId: caller.tenantId } }));
		return repository.save(
			repository.create({
				name: input.name.trim(),
				position,
				tenantId: caller.tenantId,
				organizationId: caller.organizationId ?? undefined
			})
		) as Promise<IChatCategory>;
	}

	async updateCategory(caller: IChatCaller, id: ID, input: Partial<IChatCategoryInput>): Promise<IChatCategory> {
		this.requireManage(caller);
		const repository = this.dataSource.getRepository(ChatCategory);
		const category = await repository.findOne({ where: { id, tenantId: caller.tenantId } });
		if (!category) throw new NotFoundException('The requested record was not found');
		if (typeof input.name === 'string' && input.name.trim()) category.name = input.name.trim();
		if (typeof input.position === 'number') category.position = input.position;
		return repository.save(category) as Promise<IChatCategory>;
	}

	async deleteCategory(caller: IChatCaller, id: ID): Promise<void> {
		this.requireManage(caller);
		const repository = this.dataSource.getRepository(ChatCategory);
		const category = await repository.findOne({ where: { id, tenantId: caller.tenantId } });
		if (!category) throw new NotFoundException('The requested record was not found');
		// The channels of a deleted category stay, uncategorized.
		await this.dataSource.getRepository(ChatConversation).update({ categoryId: id, tenantId: caller.tenantId }, { categoryId: null as never });
		await repository.remove(category);
	}

	// ---------------------------------------------------------------- listing

	/** The caller's conversations (active memberships), with their state, and the categories. */
	async listMine(caller: IChatCaller): Promise<IChatConversationList> {
		const categories = await this.listCategories(caller);
		if (!caller.employeeId) return { conversations: [], categories };
		const members = await this.dataSource.getRepository(ChatMember).find({
			where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() },
			take: CHAT_MAX_STATES
		});
		if (!members.length) return { conversations: [], categories };
		const conversations = await this.dataSource.getRepository(ChatConversation).find({
			where: { id: In(members.map((member) => member.conversationId)), tenantId: caller.tenantId }
		});
		const byId = new Map(members.map((member) => [String(member.conversationId), member]));
		const summaries = await this.memberSummaries(
			caller.tenantId,
			conversations.filter((conversation) => conversation.kind !== ChatConversationKindEnum.CHANNEL).map((conversation) => conversation.id as ID)
		);
		const counts = await this.memberCounts(
			caller.tenantId,
			conversations.map((conversation) => conversation.id as ID)
		);
		const list = conversations
			.map((conversation) => this.withState(conversation, byId.get(String(conversation.id)) ?? null, counts, summaries))
			.sort((a, b) => {
				const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
				const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
				return bt - at || String(a.name ?? '').localeCompare(String(b.name ?? ''));
			});
		return { conversations: list, categories };
	}

	/** Public channels of the caller's organization the caller is not in. */
	async browse(caller: IChatCaller): Promise<IChatConversationWithState[]> {
		const mine = caller.employeeId
			? await this.dataSource.getRepository(ChatMember).find({
					select: { conversationId: true },
					where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() }
			  })
			: [];
		const channels = await this.dataSource.getRepository(ChatConversation).find({
			where: {
				tenantId: caller.tenantId,
				...(caller.organizationId ? { organizationId: caller.organizationId } : {}),
				kind: ChatConversationKindEnum.CHANNEL,
				visibility: ChatVisibilityEnum.PUBLIC,
				archivedAt: IsNull(),
				...(mine.length ? { id: Not(In(mine.map((member) => member.conversationId))) } : {})
			},
			order: { name: 'ASC' }
		});
		const counts = await this.memberCounts(
			caller.tenantId,
			channels.map((channel) => channel.id as ID)
		);
		return channels.map((channel) => this.withState(channel, null, counts, new Map()));
	}

	async get(caller: IChatCaller, id: ID): Promise<IChatConversationWithState> {
		const { conversation, member } = await this.access.requireMember(id, caller);
		const counts = await this.memberCounts(caller.tenantId, [conversation.id as ID]);
		const summaries = await this.memberSummaries(caller.tenantId, [conversation.id as ID]);
		return this.withState(conversation, member, counts, summaries);
	}

	/** Every membership state of the caller, for a client's badges, plus followed threads with unread replies. */
	async states(caller: IChatCaller): Promise<IChatStates> {
		if (!caller.employeeId) return { states: [], threads: [] };
		const members = await this.dataSource.getRepository(ChatMember).find({
			where: { tenantId: caller.tenantId, employeeId: caller.employeeId, leftAt: IsNull() },
			take: CHAT_MAX_STATES
		});
		const conversations = members.length
			? await this.dataSource.getRepository(ChatConversation).find({
					select: { id: true, messageCount: true },
					where: { id: In(members.map((member) => member.conversationId)), tenantId: caller.tenantId }
			  })
			: [];
		const counts = new Map(conversations.map((conversation) => [String(conversation.id), conversation.messageCount ?? 0]));
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({
			where: { tenantId: caller.tenantId, employeeId: caller.employeeId },
			take: CHAT_MAX_STATES
		});
		const roots = follows.length
			? await this.dataSource.getRepository(ChatMessage).find({
					select: { id: true, conversationId: true },
					where: { id: In(follows.map((follow) => follow.rootMessageId)), tenantId: caller.tenantId },
					withDeleted: true
			  })
			: [];
		// A thread of a conversation the caller left is not theirs to follow any more.
		const mine = new Set(members.map((member) => String(member.conversationId)));
		const conversationOfRoot = new Map(roots.filter((root) => mine.has(String(root.conversationId))).map((root) => [String(root.id), root.conversationId]));
		return {
			states: members.map((member) => memberState(member, { messageCount: counts.get(String(member.conversationId)) ?? 0 })),
			threads: follows
				.filter((follow) => (follow.unreadReplies ?? 0) > 0 && conversationOfRoot.has(String(follow.rootMessageId)))
				.map((follow) => ({
					rootMessageId: follow.rootMessageId,
					conversationId: conversationOfRoot.get(String(follow.rootMessageId)) as ID,
					unreadReplies: follow.unreadReplies
				}))
		};
	}

	// ---------------------------------------------------------------- channels

	async createChannel(caller: IChatCaller & { employeeId: ID }, input: IChatConversationCreateInput): Promise<{ conversation: IChatConversationWithState; events: IChatEvent[] }> {
		const name = (input.name ?? '').trim();
		if (!name) throw new BadRequestException('A channel needs a name.');
		const conversation = await this.dataSource.transaction(async (manager) => {
			const created = await manager.getRepository(ChatConversation).save(
				manager.getRepository(ChatConversation).create({
					kind: ChatConversationKindEnum.CHANNEL,
					name,
					topic: input.topic?.trim() || null,
					visibility: input.visibility ?? ChatVisibilityEnum.PUBLIC,
					categoryId: input.categoryId ?? undefined,
					position: 0,
					isDefault: false,
					createdByEmployeeId: caller.employeeId,
					messageCount: 0,
					tenantId: caller.tenantId,
					organizationId: caller.organizationId ?? undefined
				})
			);
			const employees = await this.employeesOfTenant(caller.tenantId, [caller.employeeId, ...(input.memberEmployeeIds ?? [])], caller.organizationId);
			await manager.getRepository(ChatMember).save(
				employees.map((employee) =>
					manager.getRepository(ChatMember).create({
						conversationId: created.id as ID,
						employeeId: employee.id as ID,
						userId: employee.userId,
						role: String(employee.id) === String(caller.employeeId) ? ChatMemberRoleEnum.MANAGER : ChatMemberRoleEnum.MEMBER,
						notifyLevel: ChatNotifyLevelEnum.ALL,
						isFavorite: false,
						readCount: 0,
						mentionCount: 0,
						joinedAt: new Date(),
						tenantId: caller.tenantId,
						organizationId: caller.organizationId ?? undefined
					})
				)
			);
			return created;
		});
		const members = await this.access.members(caller.tenantId, conversation.id as ID);
		const events = [await this.realtime.publish(this.realtime.conversationFact(conversation, 'created', members.map((member) => member.userId)))];
		return { conversation: await this.get(caller, conversation.id as ID), events };
	}

	async updateConversation(caller: IChatCaller, id: ID, input: IChatConversationUpdateInput): Promise<{ conversation: IChatConversationWithState; events: IChatEvent[] }> {
		const { conversation } = await this.access.requireManager(id, caller);
		if (conversation.kind !== ChatConversationKindEnum.CHANNEL && (input.name !== undefined || input.visibility !== undefined)) {
			throw new BadRequestException('A direct or group conversation has no name or visibility to change.');
		}
		if (typeof input.name === 'string') {
			if (!input.name.trim()) throw new BadRequestException('A channel needs a name.');
			conversation.name = input.name.trim();
		}
		if (input.topic !== undefined) conversation.topic = input.topic?.trim() || null;
		if (input.visibility) conversation.visibility = input.visibility;
		if (typeof input.position === 'number') conversation.position = input.position;
		await this.dataSource.getRepository(ChatConversation).save(conversation);
		if (input.categoryId !== undefined) {
			// A cleared category is written as NULL: `save` leaves an undefined member untouched.
			await this.dataSource.getRepository(ChatConversation).update({ id: conversation.id as ID }, { categoryId: (input.categoryId ?? null) as never });
			conversation.categoryId = (input.categoryId ?? undefined) as ID | undefined;
		}
		const members = await this.access.members(caller.tenantId, id);
		const events = [await this.realtime.publish(this.realtime.conversationFact(conversation, 'updated', members.map((member) => member.userId)))];
		return { conversation: await this.get(caller, id), events };
	}

	async archive(caller: IChatCaller, id: ID, archived: boolean): Promise<{ conversation: IChatConversationWithState; events: IChatEvent[] }> {
		const { conversation } = await this.access.requireManager(id, caller);
		if (conversation.isDefault) throw new BadRequestException('The default channel cannot be archived.');
		const archivedAt = archived ? (conversation.archivedAt ?? new Date()) : null;
		await this.dataSource.getRepository(ChatConversation).update({ id: conversation.id as ID }, { archivedAt: archivedAt as never });
		conversation.archivedAt = archivedAt ?? undefined;
		const members = await this.access.members(caller.tenantId, id);
		const events = [
			await this.realtime.publish(this.realtime.conversationFact(conversation, archived ? 'archived' : 'updated', members.map((member) => member.userId)))
		];
		return { conversation: await this.get(caller, id), events };
	}

	// ---------------------------------------------------------------- direct and group

	/** The direct (two people) or group (three or more) conversation of these employees and the caller: found or created. */
	async direct(caller: IChatCaller & { employeeId: ID }, employeeIds: readonly ID[]): Promise<{ conversation: IChatConversationWithState; created: boolean; events: IChatEvent[] }> {
		const ids = [...new Set([caller.employeeId, ...employeeIds].map(String))];
		if (ids.length < 2) throw new BadRequestException('Name at least one other employee.');
		if (ids.length > CHAT_GROUP_MAX_MEMBERS) throw new BadRequestException(`A group holds at most ${CHAT_GROUP_MAX_MEMBERS} people.`);
		const employees = await this.employeesOfTenant(caller.tenantId, ids as ID[], caller.organizationId);
		if (employees.length !== ids.length) throw new NotFoundException('One of the employees was not found.');
		const directKey = directKeyOf(employees.map((employee) => employee.userId));
		const repository = this.dataSource.getRepository(ChatConversation);
		const existing = await repository.findOne({ where: { tenantId: caller.tenantId, directKey } });
		if (existing) {
			// A member who left a group of their own accord is back in it. A group whose membership a manager changed
			// (someone added or removed) no longer carries a key, so a removed member cannot find their way back here.
			await this.dataSource
				.getRepository(ChatMember)
				.update({ conversationId: existing.id as ID, employeeId: caller.employeeId, tenantId: caller.tenantId }, { leftAt: null as never });
			return { conversation: await this.get(caller, existing.id as ID), created: false, events: [] };
		}
		const kind = ids.length === 2 ? ChatConversationKindEnum.DIRECT : ChatConversationKindEnum.GROUP;
		const conversation = await this.createDirect(caller, kind, directKey, employees).catch(async (error) => {
			// Two first requests at once: the unique key let one in; the other answers the same conversation.
			const winner = await repository.findOne({ where: { tenantId: caller.tenantId, directKey } });
			if (!winner) throw error;
			return winner;
		});
		if (String(conversation.createdByEmployeeId ?? '') !== String(caller.employeeId) || (conversation.createdAt && Date.now() - new Date(conversation.createdAt as Date).getTime() > 5_000)) {
			return { conversation: await this.get(caller, conversation.id as ID), created: false, events: [] };
		}
		const events = [await this.realtime.publish(this.realtime.conversationFact(conversation, 'created', employees.map((employee) => employee.userId)))];
		return { conversation: await this.get(caller, conversation.id as ID), created: true, events };
	}

	private createDirect(
		caller: IChatCaller & { employeeId: ID },
		kind: ChatConversationKindEnum,
		directKey: string,
		employees: Array<{ id: ID; userId: ID }>
	): Promise<ChatConversation> {
		return this.dataSource.transaction(async (manager) => {
			const created = await manager.getRepository(ChatConversation).save(
				manager.getRepository(ChatConversation).create({
					kind,
					visibility: ChatVisibilityEnum.PRIVATE,
					position: 0,
					isDefault: false,
					createdByEmployeeId: caller.employeeId,
					messageCount: 0,
					directKey,
					tenantId: caller.tenantId,
					organizationId: caller.organizationId ?? undefined
				})
			);
			await manager.getRepository(ChatMember).save(
				employees.map((employee) =>
					manager.getRepository(ChatMember).create({
						conversationId: created.id as ID,
						employeeId: employee.id as ID,
						userId: employee.userId,
						role: ChatMemberRoleEnum.MEMBER,
						notifyLevel: ChatNotifyLevelEnum.ALL,
						isFavorite: false,
						readCount: 0,
						mentionCount: 0,
						joinedAt: new Date(),
						tenantId: caller.tenantId,
						organizationId: caller.organizationId ?? undefined
					})
				)
			);
			return created;
		});
	}

	// ---------------------------------------------------------------- membership

	async join(caller: IChatCaller & { employeeId: ID }, id: ID): Promise<{ conversation: IChatConversationWithState; events: IChatEvent[] }> {
		const conversation = await this.access.conversation(caller.tenantId, id, caller.organizationId);
		if (conversation.kind !== ChatConversationKindEnum.CHANNEL || conversation.visibility !== ChatVisibilityEnum.PUBLIC || conversation.archivedAt) {
			throw new NotFoundException('The requested record was not found');
		}
		await this.addMembers(caller, conversation, [caller.employeeId]);
		return { conversation: await this.get(caller, id), events: await this.membersChanged(caller, conversation) };
	}

	async leave(caller: IChatCaller & { employeeId: ID }, id: ID): Promise<{ events: IChatEvent[] }> {
		const { conversation, member } = await this.access.requireMember(id, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		if (conversation.isDefault) throw new BadRequestException('The default channel cannot be left.');
		if (conversation.kind === ChatConversationKindEnum.DIRECT) throw new BadRequestException('A direct conversation cannot be left.');
		await this.dataSource.getRepository(ChatMember).update({ id: member.id }, { leftAt: new Date() });
		await this.dropFollows(caller.tenantId, conversation.id as ID, caller.employeeId);
		return { events: await this.membersChanged(caller, conversation) };
	}

	async members(caller: IChatCaller, id: ID): Promise<IChatMemberSummary[]> {
		await this.access.requireMember(id, caller);
		const members = await this.access.members(caller.tenantId, id);
		return members.map((member) => ({ employeeId: member.employeeId, userId: member.userId, role: member.role, joinedAt: member.joinedAt ?? null }));
	}

	async addMembersTo(caller: IChatCaller, id: ID, employeeIds: readonly ID[]): Promise<{ members: IChatMemberSummary[]; events: IChatEvent[] }> {
		const { conversation } = await this.access.requireManager(id, caller);
		if (conversation.kind === ChatConversationKindEnum.DIRECT) throw new BadRequestException('A direct conversation has exactly two members.');
		const employees = await this.employeesOfTenant(caller.tenantId, employeeIds, conversation.organizationId ?? caller.organizationId ?? null);
		if (conversation.kind === ChatConversationKindEnum.GROUP) {
			const active = await this.access.members(caller.tenantId, id);
			const activeIds = new Set(active.map((member) => String(member.employeeId)));
			const joining = employees.filter((employee) => !activeIds.has(String(employee.id))).length;
			if (active.length + joining > CHAT_GROUP_MAX_MEMBERS) {
				throw new BadRequestException(`A group holds at most ${CHAT_GROUP_MAX_MEMBERS} people.`);
			}
		}
		await this.dataSource.transaction(async (manager) => {
			await this.addMembers(caller, conversation, employees.map((employee) => employee.id), employees, manager);
			// A group whose membership changed is no longer "the conversation of these people": its key goes, so the
			// original set resolves to a new group and a removed member cannot rejoin through it.
			if (conversation.kind === ChatConversationKindEnum.GROUP && conversation.directKey) {
				await manager.getRepository(ChatConversation).update({ id: conversation.id as ID }, { directKey: null as never });
			}
		});
		return { members: await this.members(caller, id), events: await this.membersChanged(caller, conversation) };
	}

	async removeMember(caller: IChatCaller, id: ID, employeeId: ID): Promise<{ events: IChatEvent[] }> {
		const { conversation } = await this.access.requireManager(id, caller);
		if (conversation.isDefault || conversation.kind === ChatConversationKindEnum.DIRECT) {
			throw new BadRequestException('Members of the default channel or of a direct conversation cannot be removed.');
		}
		const member = await this.dataSource.getRepository(ChatMember).findOne({ where: { conversationId: id, employeeId, tenantId: caller.tenantId, leftAt: IsNull() } });
		if (!member) throw new NotFoundException('The requested record was not found');
		const removedUserId = member.userId;
		await this.dataSource.getRepository(ChatMember).update({ id: member.id }, { leftAt: new Date() });
		await this.dropFollows(caller.tenantId, conversation.id as ID, employeeId);
		if (conversation.kind === ChatConversationKindEnum.GROUP && conversation.directKey) {
			// The removed member must not find their way back through the participants' key (see addMembersTo).
			await this.dataSource.getRepository(ChatConversation).update({ id: conversation.id as ID }, { directKey: null as never });
		}
		const events = await this.membersChanged(caller, conversation);
		events.push(await this.realtime.publish(this.realtime.conversationFact(conversation, 'removed', [removedUserId])));
		return { events };
	}

	async setMemberState(caller: IChatCaller, id: ID, input: IChatMemberStateInput): Promise<{ state: IChatMemberState; events: IChatEvent[] }> {
		const { conversation, member } = await this.access.requireMember(id, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		const patch: Partial<ChatMember> = {};
		if (input.notifyLevel) patch.notifyLevel = input.notifyLevel;
		if (typeof input.isFavorite === 'boolean') patch.isFavorite = input.isFavorite;
		// The preference columns only: a message that arrived since the read must not have its counters written back.
		if (Object.keys(patch).length) await this.dataSource.getRepository(ChatMember).update({ id: member.id }, patch as never);
		const fresh = (await this.access.membership(id, caller)) ?? Object.assign(member, patch);
		const events = [await this.realtime.publish(this.realtime.memberStateFact(fresh))];
		return { state: memberState(fresh, conversation), events };
	}

	/** The organization's default channel, created on first use with every active employee as a member. */
	async ensureDefaultChannel(caller: IChatCaller): Promise<ChatConversation | null> {
		const organizationId = caller.organizationId;
		if (!organizationId) return null;
		const repository = this.dataSource.getRepository(ChatConversation);
		// The default channel carries a key of its own under the unique (tenantId, directKey) index, so two first calls
		// at once cannot both create one; a participants' key is a hash and never collides with it.
		const directKey = `default:${organizationId}`;
		const existing = await repository.findOne({ where: { tenantId: caller.tenantId, organizationId, isDefault: true } });
		if (existing) {
			// An employee hired after the channel was created belongs to it from their first visit.
			if (caller.employeeId && !(await this.access.membership(existing.id as ID, caller))) {
				await this.addMembers(caller, existing, [caller.employeeId]);
			}
			return existing;
		}
		try {
			return await this.dataSource.transaction(async (manager) => {
				const created = await manager.getRepository(ChatConversation).save(
					manager.getRepository(ChatConversation).create({
						kind: ChatConversationKindEnum.CHANNEL,
						name: CHAT_DEFAULT_CHANNEL_NAME,
						visibility: ChatVisibilityEnum.PUBLIC,
						position: 0,
						isDefault: true,
						messageCount: 0,
						directKey,
						tenantId: caller.tenantId,
						organizationId
					})
				);
				const employees = await manager.getRepository(Employee).find({
					select: { id: true, userId: true },
					where: { tenantId: caller.tenantId, organizationId, isActive: true, isArchived: false }
				});
				await this.addMembers(caller, created, employees.map((employee) => employee.id as ID), employees, manager);
				return created;
			});
		} catch (error) {
			// Two first calls at once: the other one created it (the unique key refused this one).
			this.logger.warn(`The default channel was not created: ${(error as Error)?.message}`);
			return repository.findOne({ where: { tenantId: caller.tenantId, directKey } });
		}
	}

	// ---------------------------------------------------------------- helpers

	private requireManage(caller: IChatCaller): void {
		if (!caller.canManage) throw new ForbiddenException('Managing chat categories needs CHAT_MANAGE.');
	}

	/**
	 * The people chat shows: the active employees of the caller's organization with the name and picture a chat
	 * user may see (no email, no rate, no settings). Every holder of `CHAT_VIEW` may read it, which the employee
	 * routes of the platform do not allow: they need `ORG_EMPLOYEES_VIEW`, which an ordinary employee lacks.
	 */
	async people(caller: IChatCaller): Promise<IChatPerson[]> {
		if (!caller.organizationId) return [];
		const employees = await this.dataSource.getRepository(Employee).find({
			// `user.name` is built after the load (a virtual column), never selected.
			select: { id: true, userId: true, user: { id: true, firstName: true, lastName: true, imageUrl: true } } as never,
			where: { tenantId: caller.tenantId, organizationId: caller.organizationId, isActive: true, isArchived: false },
			relations: { user: true },
			take: CHAT_PEOPLE_MAX
		});
		return employees
			.filter((employee) => !!employee.userId)
			.map((employee) => {
				const user = employee.user as { firstName?: string | null; lastName?: string | null; name?: string | null; imageUrl?: string | null } | undefined;
				const full = [user?.firstName, user?.lastName].filter((part) => !!part && String(part).trim()).join(' ');
				return {
					employeeId: employee.id as ID,
					userId: employee.userId as ID,
					name: full || user?.name || String(employee.id),
					imageUrl: user?.imageUrl ?? null
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** The active employees of the tenant (and of one organization, when stated) among the ids. */
	private async employeesOfTenant(tenantId: ID, employeeIds: readonly ID[], organizationId: ID | null = null): Promise<Array<{ id: ID; userId: ID }>> {
		const ids = [...new Set(employeeIds.map(String))];
		if (!ids.length) return [];
		const employees = await this.dataSource.getRepository(Employee).find({
			select: { id: true, userId: true },
			where: { id: In(ids), tenantId, ...(organizationId ? { organizationId } : {}), isActive: true, isArchived: false }
		});
		return employees.map((employee) => ({ id: employee.id as ID, userId: employee.userId }));
	}

	/** Adds (or re-activates) members; silently skips unknown employees. */
	private async addMembers(
		caller: IChatCaller,
		conversation: ChatConversation,
		employeeIds: readonly ID[],
		known?: Array<{ id?: ID; userId?: ID }>,
		manager?: EntityManager
	): Promise<void> {
		const employees = known ?? (await this.employeesOfTenant(caller.tenantId, employeeIds, conversation.organizationId ?? caller.organizationId ?? null));
		if (!employees.length) return;
		const repository = (manager ?? this.dataSource).getRepository(ChatMember);
		const existing = await repository.find({ where: { conversationId: conversation.id as ID, employeeId: In(employees.map((employee) => employee.id as ID)), tenantId: caller.tenantId } });
		const byEmployee = new Map(existing.map((member) => [String(member.employeeId), member]));
		const now = new Date();
		for (const employee of employees) {
			const row = byEmployee.get(String(employee.id));
			if (row) {
				if (row.leftAt) await repository.update({ id: row.id }, { leftAt: null as never, joinedAt: now, readCount: conversation.messageCount ?? 0, mentionCount: 0 });
				continue;
			}
			await repository.save(
				repository.create({
					conversationId: conversation.id as ID,
					employeeId: employee.id as ID,
					userId: employee.userId as ID,
					role: ChatMemberRoleEnum.MEMBER,
					notifyLevel: ChatNotifyLevelEnum.ALL,
					isFavorite: false,
					// A new member starts with nothing unread: history before them is theirs to scroll, not a badge.
					readCount: conversation.messageCount ?? 0,
					mentionCount: 0,
					joinedAt: now,
					tenantId: caller.tenantId,
					organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
				})
			);
		}
	}

	/** A member who left or was removed follows none of the conversation's threads any more. */
	private async dropFollows(tenantId: ID, conversationId: ID, employeeId: ID): Promise<void> {
		const follows = await this.dataSource.getRepository(ChatThreadFollow).find({ select: { id: true, rootMessageId: true }, where: { employeeId, tenantId } });
		if (!follows.length) return;
		// Object criteria, so every column name is quoted for the dialect (a raw camelCase name is folded on Postgres).
		const roots = await this.dataSource.getRepository(ChatMessage).find({
			select: { id: true },
			where: { id: In(follows.map((follow) => follow.rootMessageId)), conversationId, tenantId },
			withDeleted: true
		});
		if (!roots.length) return;
		const rootIds = new Set(roots.map((root) => String(root.id)));
		await this.dataSource.getRepository(ChatThreadFollow).delete({ id: In(follows.filter((follow) => rootIds.has(String(follow.rootMessageId))).map((follow) => follow.id as ID)) });
	}

	private async membersChanged(caller: IChatCaller, conversation: ChatConversation): Promise<IChatEvent[]> {
		const members = await this.access.members(caller.tenantId, conversation.id as ID);
		return [await this.realtime.publish(this.realtime.conversationFact(conversation, 'members', members.map((member) => member.userId)))];
	}

	private async memberCounts(tenantId: ID, conversationIds: ID[]): Promise<Map<string, number>> {
		if (!conversationIds.length) return new Map();
		const rows = await this.dataSource
			.getRepository(ChatMember)
			.createQueryBuilder('member')
			.select('member.conversationId', 'conversationId')
			.addSelect('COUNT(*)', 'count')
			.where('member.tenantId = :tenantId', { tenantId })
			.andWhere('member.conversationId IN (:...ids)', { ids: conversationIds })
			.andWhere('member.leftAt IS NULL')
			.groupBy('member.conversationId')
			.getRawMany<{ conversationId: ID; count: string | number }>();
		return new Map(rows.map((row) => [String(row.conversationId), Number(row.count) || 0]));
	}

	private async memberSummaries(tenantId: ID, conversationIds: ID[]): Promise<Map<string, IChatMemberSummary[]>> {
		const summaries = new Map<string, IChatMemberSummary[]>();
		if (!conversationIds.length) return summaries;
		const members = await this.dataSource.getRepository(ChatMember).find({
			where: { tenantId, conversationId: In(conversationIds), leftAt: IsNull() },
			order: { joinedAt: 'ASC' }
		});
		for (const member of members) {
			const list = summaries.get(String(member.conversationId)) ?? [];
			if (list.length < 8) {
				list.push({ employeeId: member.employeeId, userId: member.userId, role: member.role, joinedAt: member.joinedAt ?? null });
			}
			summaries.set(String(member.conversationId), list);
		}
		return summaries;
	}

	private withState(
		conversation: ChatConversation,
		member: ChatMember | null,
		counts: Map<string, number>,
		summaries: Map<string, IChatMemberSummary[]>
	): IChatConversationWithState {
		return {
			...(conversation as unknown as IChatConversationWithState),
			state: member ? memberState(member, conversation) : null,
			memberCount: counts.get(String(conversation.id)) ?? 0,
			members: summaries.get(String(conversation.id)) ?? []
		};
	}
}
