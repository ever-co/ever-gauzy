import {
	Body,
	Controller,
	Get,
	Headers,
	Param,
	Post,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { UIMessage } from 'ai';
import { IAiChatConfig, IAiChatModelCatalogue, PermissionsEnum } from '@gauzy/contracts';
import { LazyFileInterceptor, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
	 *
	 * Accessible with EITHER `AI_CHAT_ACCESS` (the chat surfaces need it) OR
	 * `AI_CHAT_SETTINGS` (the BYOK "AI Providers" settings page needs it) —
	 * overriding the controller-wide `AI_CHAT_ACCESS`. Without this, a tenant
	 * admin granted only `AI_CHAT_SETTINGS` could open the settings page but got
	 * a 403 here, blanking the whole page. The payload exposes no secrets.
	 */
	@ApiOperation({ summary: 'AI chat runtime configuration for the current tenant' })
	@ApiResponse({ status: 200, description: 'AI chat configuration.' })
	@Permissions(PermissionsEnum.AI_CHAT_ACCESS, PermissionsEnum.AI_CHAT_SETTINGS)
	@Get('/config')
	async config(): Promise<IAiChatConfig> {
		return this.aiChatService.getConfig();
	}

	/**
	 * One provider's model catalogue, for the settings model picker.
	 *
	 * Separate from `/config` on purpose. `/config` is fetched at app bootstrap for every user with
	 * chat access and loops every registered provider; fetching six upstream catalogues there would
	 * put the app shell behind third-party APIs on every login. This is called lazily, for the one
	 * provider whose config view was opened.
	 *
	 * Same two-permission rule as `/config`: an admin holding only AI_CHAT_SETTINGS must be able to
	 * use the settings page. Exposes no secrets — model ids and labels only.
	 */
	@ApiOperation({ summary: "A provider's available models" })
	@ApiResponse({ status: 200, description: 'Model catalogue.' })
	@ApiResponse({ status: 400, description: 'Unknown provider.' })
	/**
	 * Speech to text for the chat's dictation control.
	 *
	 * `AI_CHAT_ACCESS` only: dictation is a way of typing a message, so anyone who may use the chat
	 * may dictate into it. Requiring AI_CHAT_SETTINGS here would gate an input method behind an
	 * administrative permission.
	 *
	 * The size cap is the real guard — audio is user-supplied and would otherwise be bounded only by
	 * how long someone holds the button. 25 MB matches what the upstream speech APIs accept, so a
	 * larger upload could never have succeeded anyway.
	 */
	@ApiOperation({ summary: 'Transcribe recorded speech' })
	@ApiResponse({ status: 200, description: 'Transcript.' })
	@ApiResponse({ status: 400, description: 'No audio uploaded.' })
	@ApiResponse({ status: 503, description: 'No provider available to transcribe.' })
	@Permissions(PermissionsEnum.AI_CHAT_ACCESS)
	@Post('/transcribe')
	@UseInterceptors(LazyFileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
	async transcribe(@UploadedFile() file: { buffer: Buffer; mimetype: string }): Promise<{ text: string }> {
		const text = await this.aiChatService.transcribe(file?.buffer, file?.mimetype ?? 'audio/webm');
		return { text };
	}

	@Permissions(PermissionsEnum.AI_CHAT_ACCESS, PermissionsEnum.AI_CHAT_SETTINGS)
	@Get('/providers/:providerId/models')
	async providerModels(@Param('providerId') providerId: string): Promise<IAiChatModelCatalogue> {
		return this.aiChatService.listProviderModels(providerId);
	}
}
