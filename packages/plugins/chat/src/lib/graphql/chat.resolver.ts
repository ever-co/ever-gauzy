import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeatureFlag } from '@gauzy/common';
import {
	FeatureEnum,
	ID,
	IChatCategory,
	IChatConversationList,
	IChatConversationWithState,
	IChatMemberSummary,
	IChatMessagePage,
	IChatMessagesQuery,
	IChatMessageWithRelations,
	IChatPerson,
	IChatStates,
	PermissionsEnum
} from '@gauzy/contracts';
import { FEATURE_GRAPHQL, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ChatMessagesQueryDTO } from '../dto/chat.dto';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatConversationService } from '../services/chat-conversation.service';
import { ChatMessageService } from '../services/chat-message.service';

/**
 * Runs the REST route's own DTO rules on GraphQL arguments: GraphQL runs no `ValidationPipe`, so without this a
 * value the route refuses (a limit past the page cap, a cursor that is no id) would reach the service here. Members
 * the DTO does not declare are dropped, as the route's `whitelist` does.
 */
export async function validatedChatInput<T extends object>(type: new () => T, value: object | null | undefined): Promise<T> {
	const dto = plainToInstance(type, value ?? {});
	const errors = await validate(dto, { whitelist: true, forbidUnknownValues: false });
	if (errors.length) {
		throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
	}
	return dto;
}

/**
 * The chat over GraphQL (the chat spec, T17): the read routes of `/api/chat`, one query each. REST and GraphQL are
 * two views of the same operations, so this resolver owns no logic: every field reaches the service method its
 * route reaches, with the caller the route takes from the credential (`ChatAccessService.caller`) and the arguments
 * the route's DTO validates.
 *
 * - **Guards and permissions are the controllers':** `TenantPermissionGuard`, `PermissionGuard` and
 *   `FeatureFlagGuard` with `CHAT_VIEW` on every field, the tenant's `FEATURE_CHAT` toggle, plus the GraphQL
 *   capability gate every resolver carries (`FEATURE_GRAPHQL`; the flags accumulate).
 * - **The caller acts as themselves:** no field takes a user, an employee or a tenant argument; a conversation the
 *   caller is not a member of is the route's 404, here too.
 * - The writes (sending, editing, membership, the caller's state) stay REST for now.
 */
@Resolver('ChatConversation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(FeatureEnum.FEATURE_CHAT)
@Permissions(PermissionsEnum.CHAT_VIEW)
export class ChatResolver {
	constructor(
		private readonly access: ChatAccessService,
		private readonly conversations: ChatConversationService,
		private readonly messages: ChatMessageService
	) {}

	/** `GET /chat/people`. */
	@Query('chatPeople')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatPeople(): Promise<IChatPerson[]> {
		return this.conversations.people(this.access.caller());
	}

	/** `GET /chat/categories`. */
	@Query('chatCategories')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatCategories(): Promise<IChatCategory[]> {
		return this.conversations.listCategories(this.access.caller());
	}

	/** `GET /chat/conversations` (the default channel is made sure of first, as the route does). */
	@Query('chatConversations')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatConversations(): Promise<IChatConversationList> {
		const caller = this.access.caller();
		await this.conversations.ensureDefaultChannel(caller);
		return this.conversations.listMine(caller);
	}

	/** `GET /chat/conversations/browse`. */
	@Query('chatBrowseConversations')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatBrowseConversations(): Promise<IChatConversationWithState[]> {
		return this.conversations.browse(this.access.caller());
	}

	/** `GET /chat/states`. */
	@Query('chatStates')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatStates(): Promise<IChatStates> {
		return this.conversations.states(this.access.caller());
	}

	/** `GET /chat/conversations/:id` (the route's 404 unless the caller is a member). */
	@Query('chatConversation')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatConversation(@Args('id', UUIDValidationPipe) id: ID): Promise<IChatConversationWithState> {
		return this.conversations.get(this.access.caller(), id);
	}

	/** `GET /chat/conversations/:id/members`. */
	@Query('chatConversationMembers')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatConversationMembers(@Args('id', UUIDValidationPipe) id: ID): Promise<IChatMemberSummary[]> {
		return this.conversations.members(this.access.caller(), id);
	}

	/** `GET /chat/conversations/:id/messages`, with the route's query (validated as the route validates it). */
	@Query('chatMessages')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatMessages(
		@Args('conversationId', UUIDValidationPipe) conversationId: ID,
		@Args('query') query?: IChatMessagesQuery | null
	): Promise<IChatMessagePage> {
		return this.messages.list(this.access.caller(), conversationId, await validatedChatInput(ChatMessagesQueryDTO, query));
	}

	/** `GET /chat/conversations/:id/pins`. */
	@Query('chatPins')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatPins(@Args('conversationId', UUIDValidationPipe) conversationId: ID): Promise<IChatMessageWithRelations[]> {
		return this.messages.pins(this.access.caller(), conversationId);
	}

	/** `GET /chat/threads`. */
	@Query('chatThreads')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatThreads(): Promise<Array<IChatMessageWithRelations & { unreadReplies: number }>> {
		return this.messages.followedThreads(this.access.caller());
	}

	/** `GET /chat/messages/:id/thread`, with the route's query. */
	@Query('chatThread')
	@Permissions(PermissionsEnum.CHAT_VIEW)
	async chatThread(
		@Args('messageId', UUIDValidationPipe) messageId: ID,
		@Args('query') query?: IChatMessagesQuery | null
	): Promise<IChatMessagePage & { root: IChatMessageWithRelations }> {
		return this.messages.thread(this.access.caller(), messageId, await validatedChatInput(ChatMessagesQueryDTO, query));
	}
}
