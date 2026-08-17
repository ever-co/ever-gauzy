import {
	Body,
	Controller,
	ExecutionContext,
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
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import type { UIMessage } from 'ai';
import {
	IAiChatConfig,
	IAiChatModelCatalogue,
	PermissionsEnum,
	UploadedFile as IUploadedFile
} from '@gauzy/contracts';
import {
	FileStorage,
	LazyFileInterceptor,
	PermissionGuard,
	Permissions,
	RequestContext,
	TenantPermissionGuard
} from '@gauzy/core';
import { AiChatService, MAX_AUDIO_BYTES } from './ai-chat.service';
import {
	AiChatAttachmentService,
	IAiChatAttachmentResult,
	MAX_ATTACHMENT_BYTES
} from './attachments/ai-chat-attachment.service';

/**
 * Per-request storage engine of the attachment endpoint.
 *
 * Keys land under `ai-chat/<tenantId>/<organizationId>/` with a SERVER-GENERATED object name —
 * the client filename never enters the key, and the extension is stripped down to alphanumerics.
 * Mirrors the Documents upload endpoint, which is the other place user-supplied files are stored.
 */
const attachmentsStorage = (ctx: ExecutionContext) => {
	const request: any = ctx.switchToHttp().getRequest();
	const tenantId = RequestContext.currentTenantId() || randomUUID();
	const rawOrganizationId: string = request?.headers?.['organization-id'] || randomUUID();
	// Path-sanitize: ids are UUIDs, but never trust a header verbatim.
	const organizationId = String(rawOrganizationId).replace(/[^a-zA-Z0-9-]/g, '') || randomUUID();

	return new FileStorage().storage({
		dest: () => path.join('ai-chat', tenantId, organizationId),
		prefix: 'ai-chat',
		filename: (_file: any, extension: string) => {
			const safeExtension = String(extension ?? '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '');
			return safeExtension ? `${randomUUID()}.${safeExtension}` : `${randomUUID()}`;
		}
	});
};

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
	constructor(
		private readonly aiChatService: AiChatService,
		private readonly attachmentService: AiChatAttachmentService
	) {}

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
	// multer's LIMIT_FILE_SIZE surfaces as PayloadTooLargeException via transformException.
	@ApiResponse({ status: 413, description: 'Recording exceeds the 25 MB limit.' })
	@ApiResponse({
		status: 503,
		description:
			'No provider available to transcribe, or every attempt failed. Body: `{ message, code, settingsPath }` where `code` is an `AiSpeechErrorCode`.'
	})
	@Permissions(PermissionsEnum.AI_CHAT_ACCESS)
	@Post('/transcribe')
	@UseInterceptors(
		LazyFileInterceptor('file', {
			// Memory specifically: the handler reads `file.buffer`, which only memoryStorage populates.
			// A disk/FileStorage factory would leave it undefined and the service would then reject the
			// upload as empty — the audio never touches disk, it is forwarded straight upstream.
			//
			// (`storage` being omitted entirely is what broke this endpoint originally. It is now
			// required by LazyFileInterceptor's own signature, so that mistake no longer compiles.)
			storage: () => memoryStorage(),
			// The same constant the service checks — declared here too so an oversized upload is
			// rejected by multer BEFORE memoryStorage buffers all of it in RAM. The service check
			// remains as the second line of defense (and covers callers that bypass this route).
			// Forwarding `limits` at all is part of this change; declaring it earlier would have
			// silently held nothing.
			limits: { fileSize: MAX_AUDIO_BYTES }
		})
	)
	async transcribe(
		@UploadedFile() file: { buffer: Buffer; mimetype: string },
		@Body() body?: { language?: string }
	): Promise<{ text: string }> {
		// Optional language hint (ISO-639-1 / BCP-47), sanitized to the tag grammar: it travels into a
		// provider request as a form field, so anything else is dropped rather than forwarded.
		const language =
			typeof body?.language === 'string' && /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(body.language)
				? body.language
				: undefined;
		const text = await this.aiChatService.transcribe(file?.buffer, file?.mimetype ?? 'audio/webm', {
			...(language ? { language } : {})
		});
		return { text };
	}

	/**
	 * Attach a file to a chat conversation.
	 *
	 * The bytes are streamed straight into the configured `FileStorage` provider (never buffered
	 * in memory — unlike dictation, which forwards the audio upstream and so must hold it), and
	 * the save is announced as `AiChatAttachmentSavedEvent`. `@gauzy/plugin-docs` subscribes to
	 * that event and turns the attachment into a `Document { source: CHAT }`, after which the
	 * chat's own `docs_search` / `docs_read` tools can read it. Installs without that plugin
	 * simply have no subscriber.
	 *
	 * `AI_CHAT_ACCESS` only, for the same reason as dictation: attaching a file is part of
	 * composing a message, not an administrative act.
	 */
	@ApiOperation({ summary: 'Attach a file to a chat conversation' })
	@ApiConsumes('multipart/form-data')
	@ApiResponse({ status: 201, description: 'The stored attachment descriptor.' })
	@ApiResponse({ status: 400, description: 'No file uploaded, or no organization scope.' })
	// multer's LIMIT_FILE_SIZE surfaces as PayloadTooLargeException via transformException.
	@ApiResponse({ status: 413, description: 'Attachment exceeds the 25 MB limit.' })
	@Permissions(PermissionsEnum.AI_CHAT_ACCESS)
	@Post('/attachments')
	@UseInterceptors(
		LazyFileInterceptor('file', {
			storage: (ctx: ExecutionContext) => attachmentsStorage(ctx),
			// The same constant the service's cap derives from, declared here so an oversized
			// upload is rejected by multer BEFORE the provider stores any of it.
			limits: { fileSize: MAX_ATTACHMENT_BYTES }
		})
	)
	async attach(
		@UploadedFile() file: IUploadedFile,
		@Body() body: { conversationId?: string }
	): Promise<IAiChatAttachmentResult> {
		return this.attachmentService.save(file, body?.conversationId);
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
	@Permissions(PermissionsEnum.AI_CHAT_ACCESS, PermissionsEnum.AI_CHAT_SETTINGS)
	@Get('/providers/:providerId/models')
	async providerModels(@Param('providerId') providerId: string): Promise<IAiChatModelCatalogue> {
		return this.aiChatService.listProviderModels(providerId);
	}
}
