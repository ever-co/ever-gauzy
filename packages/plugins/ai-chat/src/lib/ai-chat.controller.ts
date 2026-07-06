import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { UIMessage } from 'ai';
import { IAiChatConfig, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { AiChatService } from './ai-chat.service';

/** Request body sent by the `useChat` client (Vercel AI SDK UI). */
export interface IAiChatRequestBody {
	messages: UIMessage[];
	/** Optional provider/model override (playground). */
	providerId?: string;
	modelId?: string;
	/** Conversation to persist this turn to (client-generated UUID). */
	conversationId?: string;
}

@ApiTags('AI Chat')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.AI_CHAT_ACCESS)
@Controller('/ai-chat')
export class AiChatController {
	constructor(private readonly aiChatService: AiChatService) {}

	/**
	 * Stream one chat turn as a Vercel AI SDK UI message stream (SSE).
	 * The agent's API tools run with the caller's own JWT — the agent can
	 * only see and do what the calling user is permitted to.
	 */
	@ApiOperation({ summary: 'AI agent chat — streams a Vercel AI SDK UI message stream' })
	@ApiResponse({ status: 200, description: 'UI message stream (text/event-stream).' })
	@ApiResponse({ status: 400, description: 'Invalid messages payload.' })
	@ApiResponse({ status: 503, description: 'AI chat is not configured (no provider credentials).' })
	@Post('/')
	async chat(
		@Body() body: IAiChatRequestBody,
		@Req() request: Request,
		@Res() response: Response,
		@Headers('language') languageCode?: string
	): Promise<void> {
		await this.aiChatService.streamChat({
			messages: body?.messages,
			providerId: body?.providerId,
			modelId: body?.modelId,
			conversationId: body?.conversationId,
			authorizationHeader: request.headers.authorization ?? '',
			languageCode,
			response
		});
	}

	/**
	 * Runtime configuration for the current tenant: registered providers,
	 * their models, configuration status and defaults. No secrets.
	 */
	@ApiOperation({ summary: 'AI chat runtime configuration for the current tenant' })
	@ApiResponse({ status: 200, description: 'AI chat configuration.' })
	@Get('/config')
	async config(): Promise<IAiChatConfig> {
		return this.aiChatService.getConfig();
	}
}
