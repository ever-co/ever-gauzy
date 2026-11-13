import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import {
	ChatCategoryDTO,
	ChatCategoryReorderDTO,
	ChatCategoryUpdateDTO,
	ChatConversationCreateDTO,
	ChatConversationUpdateDTO,
	ChatDirectDTO,
	ChatMembersDTO,
	ChatMemberStateDTO,
	ChatFilesQueryDTO,
	ChatMessageCreateDTO,
	ChatMessagesQueryDTO,
	ChatReadDTO,
	ChatTypingDTO
} from '../dto/chat.dto';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatConversationService } from '../services/chat-conversation.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatTypingService } from '../services/chat-typing.service';

/**
 * `/api/chat/categories*`, `/api/chat/conversations*`, `/api/chat/direct`: the conversations of the caller. Every
 * route needs a signed-in user of the tenant with `CHAT_VIEW` and the `FEATURE_CHAT` toggle of the tenant. A write
 * that others see (creating, joining, leaving, sending, membership) needs `CHAT_SEND` as well; the caller's own
 * state (read position, notify level, favourite) is theirs with `CHAT_VIEW`; categories and any conversation's
 * management need `CHAT_MANAGE` or a manager role on the conversation. A conversation the caller is not
 * a member of answers 404. Answers are `Cache-Control: no-store`.
 *
 * A write route's `@Permissions` replace the class's `CHAT_VIEW` (and the guard reads permissions as alternatives),
 * so `CHAT_VIEW` "as well" is checked by `ChatAccessService.caller()`, which every handler reads its caller from.
 */
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_CHAT)
@Permissions(PermissionsEnum.CHAT_VIEW)
@Controller(CHAT_ROUTE_PREFIX)
export class ChatConversationController {
	constructor(
		private readonly access: ChatAccessService,
		private readonly conversations: ChatConversationService,
		private readonly messages: ChatMessageService,
		private readonly typingSignals: ChatTypingService
	) {}

	// ---------------------------------------------------------------- categories

	@Get('/people')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The people chat shows: the active employees of my organization, with name and picture.' })
	people() {
		return this.conversations.people(this.access.caller());
	}

	@Get('/categories')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The sidebar categories channels are grouped under.' })
	listCategories() {
		return this.conversations.listCategories(this.access.caller());
	}

	@Post('/categories')
	@Permissions(PermissionsEnum.CHAT_MANAGE)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create a category (CHAT_MANAGE).' })
	createCategory(@Body() body: ChatCategoryDTO) {
		return this.conversations.createCategory(this.access.caller(), body);
	}

	@Post('/categories/reorder')
	@Permissions(PermissionsEnum.CHAT_MANAGE)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Save the order of the categories, and of the channels within them, in one transaction (CHAT_MANAGE).' })
	reorderCategories(@Body() body: ChatCategoryReorderDTO) {
		return this.conversations.reorderCategories(this.access.caller(), body);
	}

	@Patch('/categories/:id')
	@Permissions(PermissionsEnum.CHAT_MANAGE)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Rename or reorder a category (CHAT_MANAGE).' })
	updateCategory(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatCategoryUpdateDTO) {
		return this.conversations.updateCategory(this.access.caller(), id, body);
	}

	@Delete('/categories/:id')
	@Permissions(PermissionsEnum.CHAT_MANAGE)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete a category; its channels stay, uncategorized (CHAT_MANAGE).' })
	async deleteCategory(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.conversations.deleteCategory(this.access.caller(), id);
	}

	// ---------------------------------------------------------------- conversations

	@Get('/conversations')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My conversations with my state (unread and mention counts), and the categories.' })
	async listMine() {
		const caller = this.access.caller();
		await this.conversations.ensureDefaultChannel(caller);
		return this.conversations.listMine(caller);
	}

	@Get('/conversations/browse')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Public channels I am not in.' })
	browse() {
		return this.conversations.browse(this.access.caller());
	}

	@Post('/conversations')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create a channel (public or private) with the caller as its manager.' })
	createChannel(@Body() body: ChatConversationCreateDTO) {
		return this.conversations.createChannel(this.access.employeeCaller(), body);
	}

	@Post('/direct')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Find or create the direct (two people) or group (three or more) conversation of these employees and me.' })
	direct(@Body() body: ChatDirectDTO) {
		return this.conversations.direct(this.access.employeeCaller(), body.employeeIds);
	}

	@Get('/states')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My state of every conversation (for badges) and my followed threads with unread replies.' })
	states() {
		return this.conversations.states(this.access.caller());
	}

	@Get('/conversations/:id')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One conversation with my state; 404 unless I am a member.' })
	get(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.get(this.access.caller(), id);
	}

	@Patch('/conversations/:id')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Edit a channel (name, topic, visibility, category); its managers and CHAT_MANAGE holders.' })
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatConversationUpdateDTO) {
		return this.conversations.updateConversation(this.access.caller(), id, body);
	}

	@Post('/conversations/:id/archive')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Archive a conversation (read-only from now on).' })
	archive(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.archive(this.access.caller(), id, true);
	}

	@Post('/conversations/:id/unarchive')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Bring an archived conversation back.' })
	unarchive(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.archive(this.access.caller(), id, false);
	}

	@Post('/conversations/:id/join')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Join a public channel.' })
	join(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.join(this.access.employeeCaller(), id);
	}

	@Post('/conversations/:id/leave')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Leave a channel or a group (not the default channel, not a direct conversation).' })
	leave(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.leave(this.access.employeeCaller(), id);
	}

	@Post('/conversations/:id/typing')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.ACCEPTED)
	@Throttle({ default: { limit: 120, ttl: 60_000 } })
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Tell the other members that I am typing here (or in a thread): ephemeral, nothing stored, shown for a few seconds.' })
	typing(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatTypingDTO) {
		return this.typingSignals.typing(this.access.employeeCaller(), id, body ?? {});
	}

	@Get('/conversations/:id/members')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The members of a conversation I am in.' })
	members(@Param('id', UUIDValidationPipe) id: ID) {
		return this.conversations.members(this.access.caller(), id);
	}

	@Post('/conversations/:id/members')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Add employees to a channel or group (its managers).' })
	addMembers(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatMembersDTO) {
		return this.conversations.addMembersTo(this.access.caller(), id, body.employeeIds);
	}

	@Delete('/conversations/:id/members/:employeeId')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Remove an employee from a channel or group (its managers).' })
	removeMember(@Param('id', UUIDValidationPipe) id: ID, @Param('employeeId', UUIDValidationPipe) employeeId: ID) {
		return this.conversations.removeMember(this.access.caller(), id, employeeId);
	}

	@Patch('/conversations/:id/state')
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My notify level and favourite flag for a conversation.' })
	setState(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatMemberStateDTO) {
		return this.conversations.setMemberState(this.access.caller(), id, body);
	}

	@Post('/conversations/:id/read')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark the conversation read up to a message (default: everything).' })
	read(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatReadDTO) {
		return this.messages.read(this.access.employeeCaller(), id, body?.messageId);
	}

	// ---------------------------------------------------------------- messages of a conversation

	@Get('/conversations/:id/messages')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'A page of messages (newest by default; before / after / around a message id).' })
	listMessages(@Param('id', UUIDValidationPipe) id: ID, @Query() query: ChatMessagesQueryDTO) {
		return this.messages.list(this.access.caller(), id, query);
	}

	@Get('/conversations/:id/pins')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The pinned messages of a conversation.' })
	pins(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.pins(this.access.caller(), id);
	}

	@Get('/conversations/:id/files')
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true, transform: true })
	@ApiOperation({ summary: 'The files the messages of a conversation carry, newest first (the document links the sends wrote).' })
	files(@Param('id', UUIDValidationPipe) id: ID, @Query() query: ChatFilesQueryDTO) {
		return this.messages.files(this.access.caller(), id, query);
	}

	@Post('/conversations/:id/messages')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Send a message (or a thread reply with threadRootId); answers the message and the events it caused.' })
	send(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatMessageCreateDTO) {
		return this.messages.send(this.access.employeeCaller(), id, body);
	}
}
