import { Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { AiChatConversationService } from './ai-chat-conversation.service';

/**
 * Per-user AI chat conversation history endpoints.
 *
 * All routes require the `AI_CHAT_ACCESS` permission (every chat user
 * manages their OWN history — no admin permission needed) and operate
 * strictly on `RequestContext.currentUserId()`: a user can only ever
 * list, read, or delete conversations they own, within their tenant.
 */
@ApiTags('AI Chat Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.AI_CHAT_ACCESS)
@Controller('/ai-chat/conversations')
export class AiChatConversationController {
	constructor(private readonly aiChatConversationService: AiChatConversationService) {}

	/**
	 * List the current user's conversations (newest first). Transcripts are
	 * not included — only id, title, and last-update time.
	 *
	 * @returns Conversation summaries for the current user.
	 */
	@ApiOperation({ summary: "List the current user's AI chat conversations (id, title, updatedAt)." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Conversations retrieved successfully.' })
	@Get('/')
	async findAll(): Promise<Array<{ id: string; title: string; updatedAt: Date }>> {
		return await this.aiChatConversationService.listForUser(
			RequestContext.currentUserId(),
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Load one of the current user's conversations, including the parsed
	 * message transcript.
	 *
	 * @param id - The UUID of the conversation to load.
	 * @returns The conversation with its parsed `UIMessage[]` transcript.
	 */
	@ApiOperation({ summary: "Get one of the current user's AI chat conversations, with messages." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Conversation retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<{ id: string; title: string; messages: unknown[] }> {
		const conversation = await this.aiChatConversationService.getForUser(
			id,
			RequestContext.currentUserId(),
			RequestContext.currentTenantId()
		);
		if (!conversation) {
			throw new NotFoundException(`Conversation '${id}' was not found`);
		}
		return conversation;
	}

	/**
	 * Delete one of the current user's conversations.
	 *
	 * @param id - The UUID of the conversation to delete.
	 */
	@ApiOperation({ summary: "Delete one of the current user's AI chat conversations." })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The conversation has been successfully deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		const deleted = await this.aiChatConversationService.deleteForUser(
			id,
			RequestContext.currentUserId(),
			RequestContext.currentTenantId()
		);
		if (!deleted) {
			throw new NotFoundException(`Conversation '${id}' was not found`);
		}
	}
}
