import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ChatMemberRoleEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMember } from '../entities/chat-member.entity';

/** Who is calling, read from the credential and never from a body. */
export interface IChatCaller {
	tenantId: ID;
	organizationId: ID | null;
	userId: ID;
	employeeId: ID | null;
	/** Holds `CHAT_MANAGE`: manages categories and any conversation, deletes any message. */
	canManage: boolean;
}

/**
 * The access rules every chat read and write goes through.
 *
 * - The caller is the credential's user; their employee record is what memberships are keyed by.
 * - A conversation the caller is not a member of reads as **not found** (never "forbidden": a non-member learns
 *   nothing about a private conversation's existence), except for `CHAT_MANAGE` holders on channels.
 * - A conversation is managed by its managers (the creator is one) and by `CHAT_MANAGE` holders.
 */
@Injectable()
export class ChatAccessService {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * The caller of a chat route, who must hold `CHAT_VIEW`.
	 *
	 * Every chat route needs `CHAT_VIEW`, a write needs its own permission (`CHAT_SEND`, `CHAT_MANAGE`) as well. The
	 * permission guard reads a route's permissions as alternatives and the handler's `@Permissions` replace the
	 * controller's, so a write route only asks for the write permission: a role whose `CHAT_VIEW` was taken away
	 * could still send, create conversations and read back what it wrote. `CHAT_VIEW` is checked here, where every
	 * route — REST and GraphQL — reads its caller, so no write route can leave it out (the way the order transaction
	 * route checks its second grant in its body).
	 *
	 * @throws ForbiddenException when the caller lacks `CHAT_VIEW`.
	 */
	caller(): IChatCaller {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) {
			throw new UnauthorizedException('Chat needs a signed-in user of a tenant.');
		}
		if (!RequestContext.hasPermission(PermissionsEnum.CHAT_VIEW)) {
			throw new ForbiddenException(`Chat needs ${PermissionsEnum.CHAT_VIEW}.`);
		}
		return {
			tenantId,
			organizationId: RequestContext.currentOrganizationId() ?? null,
			userId,
			employeeId: RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? null,
			canManage: RequestContext.hasPermission(PermissionsEnum.CHAT_MANAGE)
		};
	}

	/** The caller as an employee; a user without an employee record cannot take part in chat. */
	employeeCaller(): IChatCaller & { employeeId: ID } {
		const caller = this.caller();
		if (!caller.employeeId) {
			throw new ForbiddenException('Only an employee can take part in chat.');
		}
		return caller as IChatCaller & { employeeId: ID };
	}

	/**
	 * A conversation of the caller's tenant — and of the caller's organization, when the request is scoped to one
	 * and the conversation belongs to one — or not found. The platform's organization boundary applies to every
	 * lookup, so an employee of one organization never joins or reads another organization's channel.
	 */
	async conversation(tenantId: ID, id: ID, organizationId: ID | null = null): Promise<ChatConversation> {
		const conversation = await this.dataSource.getRepository(ChatConversation).findOne({ where: { id, tenantId } });
		if (!conversation || (organizationId && conversation.organizationId && String(conversation.organizationId) !== String(organizationId))) {
			throw new NotFoundException('The requested record was not found');
		}
		return conversation;
	}

	/** The caller's active membership of a conversation, or null. */
	async membership(conversationId: ID, caller: IChatCaller, manager?: EntityManager): Promise<ChatMember | null> {
		if (!caller.employeeId) return null;
		return (manager ?? this.dataSource).getRepository(ChatMember).findOne({
			where: { conversationId, employeeId: caller.employeeId, tenantId: caller.tenantId, leftAt: IsNull() }
		});
	}

	/**
	 * The conversation and the caller's membership, or not found. A `CHAT_MANAGE` holder reads a channel they are
	 * not in (to manage it); a direct or group conversation is its members' only.
	 */
	async requireMember(conversationId: ID, caller: IChatCaller): Promise<{ conversation: ChatConversation; member: ChatMember | null }> {
		const conversation = await this.conversation(caller.tenantId, conversationId, caller.organizationId);
		const member = await this.membership(conversationId, caller);
		if (!member && !(caller.canManage && conversation.kind === 'channel')) {
			throw new NotFoundException('The requested record was not found');
		}
		return { conversation, member };
	}

	/** The conversation when the caller may manage it (manager, creator or `CHAT_MANAGE`), else forbidden / not found. */
	async requireManager(conversationId: ID, caller: IChatCaller): Promise<{ conversation: ChatConversation; member: ChatMember | null }> {
		const { conversation, member } = await this.requireMember(conversationId, caller);
		const isCreator = !!caller.employeeId && String(conversation.createdByEmployeeId ?? '') === String(caller.employeeId);
		if (!caller.canManage && !isCreator && member?.role !== ChatMemberRoleEnum.MANAGER) {
			throw new ForbiddenException('Only a manager of this conversation can do that.');
		}
		return { conversation, member };
	}

	/** The active members of a conversation. */
	async members(tenantId: ID, conversationId: ID, manager?: EntityManager): Promise<ChatMember[]> {
		return (manager ?? this.dataSource).getRepository(ChatMember).find({
			where: { conversationId, tenantId, leftAt: IsNull() },
			order: { joinedAt: 'ASC' }
		});
	}
}
