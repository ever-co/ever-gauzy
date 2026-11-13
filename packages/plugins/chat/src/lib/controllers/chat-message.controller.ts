import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatCreateTaskDTO, ChatMessagesQueryDTO, ChatMessageUpdateDTO, ChatRestoreReadDTO, ChatSearchQueryDTO, ChatTaskUpdateDTO } from '../dto/chat.dto';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatDraftUploadService } from '../services/chat-draft-upload.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatSearchService } from '../services/chat-search.service';
import { ChatTaskCardService } from '../services/chat-task-card.service';

/**
 * `/api/chat/messages*`, `/api/chat/threads`, `/api/chat/read-all`, `/api/chat/read-restore`: one message, its thread
 * and the caller's bulk read state. Same guards and 404 semantics as the conversation routes: a write others see
 * (editing, deleting, pinning, reacting) needs `CHAT_SEND` as well as `CHAT_VIEW` (the second checked by
 * `ChatAccessService.caller()`: a handler's `@Permissions` replace the class's); the caller's own read and follow
 * state needs `CHAT_VIEW`. The emoji of a reaction route arrives decoded by the framework: it is used as is.
 */
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_CHAT)
@Permissions(PermissionsEnum.CHAT_VIEW)
@Controller(CHAT_ROUTE_PREFIX)
export class ChatMessageController {
	constructor(
		private readonly access: ChatAccessService,
		private readonly messages: ChatMessageService,
		private readonly chatSearch: ChatSearchService,
		private readonly taskCards: ChatTaskCardService,
		private readonly drafts: ChatDraftUploadService
	) {}

	@Get('/search')
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true, transform: true })
	@ApiOperation({ summary: 'Search the messages of my conversations (one of them with conversationId): best match first, with relations.' })
	search(@Query() query: ChatSearchQueryDTO) {
		return this.chatSearch.search(this.access.caller(), query);
	}

	@Get('/threads')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The threads I follow, with unread reply counts.' })
	threads() {
		return this.messages.followedThreads(this.access.caller());
	}

	@Post('/read-all')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark every conversation of mine read; answers an undo handle valid for a minute.' })
	readAll() {
		return this.messages.readAll(this.access.employeeCaller());
	}

	@Post('/read-restore')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Undo a mark-all-read within its minute.' })
	restoreRead(@Body() body: ChatRestoreReadDTO) {
		return this.messages.restoreRead(this.access.caller(), body.snapshotId);
	}

	@Get('/messages/:id/thread')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'A thread: its root and its replies, oldest first.' })
	thread(@Param('id', UUIDValidationPipe) id: ID, @Query() query: ChatMessagesQueryDTO) {
		return this.messages.thread(this.access.caller(), id, query);
	}

	@Post('/messages/:id/thread/read')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark a thread I follow read (its unread replies go to zero).' })
	markThreadRead(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.markThreadRead(this.access.caller(), id);
	}

	@Patch('/messages/:id')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Edit my message.' })
	edit(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatMessageUpdateDTO) {
		return this.messages.edit(this.access.caller(), id, body);
	}

	@Delete('/messages/:id')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Delete my message (or any message with CHAT_MANAGE); a thread root stays as a tombstone.' })
	remove(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.remove(this.access.caller(), id);
	}

	@Post('/messages/:id/create-task')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.CREATED)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true, transform: true })
	@ApiOperation({ summary: 'Create a task from a message (its first line as the title unless one is given); the message keeps a reference to the task. Needs ORG_TASK_ADD too.' })
	createTask(@Param('id', UUIDValidationPipe) id: ID, @Body() input: ChatCreateTaskDTO) {
		return this.messages.createTask(this.access.caller(), id, input);
	}

	@Patch('/messages/:id/tasks/:taskId')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary:
			"Change a task from its card in a message (status, priority, assignees) through the platform's task update: ORG_TASK_EDIT too, and the task page's activity log."
	})
	updateTask(@Param('id', UUIDValidationPipe) id: ID, @Param('taskId', UUIDValidationPipe) taskId: ID, @Body() body: ChatTaskUpdateDTO) {
		return this.taskCards.update(this.access.caller(), id, taskId, body);
	}

	@Delete('/attachments/:documentId')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Discard a file I uploaded for a message and will not send (a draft upload): the file and its stored bytes go; a sent file stays.' })
	discardAttachment(@Param('documentId', UUIDValidationPipe) documentId: ID) {
		return this.drafts.discard(this.access.caller(), documentId);
	}

	@Post('/messages/:id/pin')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Pin a message in its conversation.' })
	pin(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.pin(this.access.caller(), id, true);
	}

	@Post('/messages/:id/unpin')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Unpin a message.' })
	unpin(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.pin(this.access.caller(), id, false);
	}

	@Post('/messages/:id/unread')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark the conversation unread from this message on.' })
	unreadFrom(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.unreadFrom(this.access.employeeCaller(), id);
	}

	@Post('/messages/:id/follow')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Follow the thread this message roots.' })
	follow(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.setFollow(this.access.employeeCaller(), id, true);
	}

	@Post('/messages/:id/unfollow')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Stop following a thread.' })
	unfollow(@Param('id', UUIDValidationPipe) id: ID) {
		return this.messages.setFollow(this.access.employeeCaller(), id, false);
	}

	@Post('/messages/:id/reactions/:emoji')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'React to a message with an emoji.' })
	react(@Param('id', UUIDValidationPipe) id: ID, @Param('emoji') emoji: string) {
		return this.messages.react(this.access.employeeCaller(), id, emoji ?? '', true);
	}

	@Delete('/messages/:id/reactions/:emoji')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Take my reaction back.' })
	unreact(@Param('id', UUIDValidationPipe) id: ID, @Param('emoji') emoji: string) {
		return this.messages.react(this.access.employeeCaller(), id, emoji ?? '', false);
	}
}
