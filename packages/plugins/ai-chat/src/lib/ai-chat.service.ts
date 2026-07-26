import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import type { UIMessage, LanguageModel } from 'ai';
import { IAiChatConfig, IAiChatProvider } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { loadAiSdk } from './esm-loader';
import { AiProviderRegistry } from './provider-registry';
import { IAiChatProviderDefinition, IAiProviderCredentials } from './provider.types';
import { buildSystemPrompt } from './system-prompt';
import { GauzyApiClient } from './tools/gauzy-api-client';
import { buildGauzyTools, GAUZY_TOOLS_REQUIRING_APPROVAL } from './tools/gauzy-tools';
import { buildClientTools, CLIENT_TOOLS_REQUIRING_APPROVAL } from './tools/client-tools';
import { createMcpTools } from './tools/mcp-tools';
import { AiProviderCredentialService } from './credentials/ai-provider-credential.service';
import { AiChatConversationService } from './conversations/ai-chat-conversation.service';

/** Maximum agent steps (model turns incl. tool calls) per user message. */
const MAX_STEPS = 12;

export interface IStreamChatArgs {
	/** UI messages from the `useChat` client. */
	messages: UIMessage[];
	/** Optional provider override (defaults to tenant/env default). */
	providerId?: string;
	/** Optional model override. */
	modelId?: string;
	/**
	 * Conversation to append this turn to (client-generated UUID).
	 * The full message list is persisted for the requesting user after
	 * the stream finishes; omitted → the turn is not persisted.
	 */
	conversationId?: string;
	/** The requesting user's `Authorization` header — forwarded to all API tools. */
	authorizationHeader: string;
	/** Preferred response language (ISO code). */
	languageCode?: string;
	/** Express response to stream the UI message stream into. */
	response: Response;
}

/**
 * AiChatService
 *
 * The chat engine: resolves the tenant's AI provider + model, assembles the
 * tool set (curated Gauzy REST tools with the user's own JWT, client/canvas
 * tools, optional MCP tools) and streams a Vercel AI SDK UI message stream
 * back to the browser.
 */
@Injectable()
export class AiChatService {
	private readonly logger = new Logger(AiChatService.name);

	constructor(
		private readonly credentialService: AiProviderCredentialService,
		private readonly conversationService: AiChatConversationService
	) {}

	/**
	 * Handle one chat turn: run the agent loop and pipe the UI message
	 * stream into the HTTP response.
	 */
	async streamChat(args: IStreamChatArgs): Promise<void> {
		if (!Array.isArray(args.messages) || args.messages.length === 0) {
			throw new BadRequestException('messages must be a non-empty array of UI messages.');
		}

		const ai = await loadAiSdk();
		const { model } = await this.resolveModel(args.providerId, args.modelId);

		const user = RequestContext.currentUser();
		const requestDefaults = {
			organizationId: RequestContext.currentOrganizationId() ?? undefined,
			tenantId: RequestContext.currentTenantId() ?? undefined,
			employeeId: RequestContext.currentEmployeeId() ?? undefined
		};

		const apiClient = new GauzyApiClient(args.authorizationHeader, {
			...(requestDefaults.tenantId ? { 'Tenant-Id': requestDefaults.tenantId } : {}),
			...(requestDefaults.organizationId ? { 'Organization-Id': requestDefaults.organizationId } : {})
		});
		const [gauzyTools, clientTools, mcp] = await Promise.all([
			buildGauzyTools(apiClient, requestDefaults),
			buildClientTools(),
			createMcpTools(args.authorizationHeader)
		]);

		const instructions = buildSystemPrompt({
			userName: user?.name,
			roleName: (user as any)?.role?.name,
			employeeId: user?.employeeId ?? undefined,
			languageCode: args.languageCode
		});

		const mcpToolNames = Object.keys((mcp?.tools as object) ?? {});
		// MCP tools are external — we cannot know which ones mutate state, so
		// EVERY MCP tool requires the user's explicit in-chat approval.
		const approvalRequired = [
			...GAUZY_TOOLS_REQUIRING_APPROVAL,
			...CLIENT_TOOLS_REQUIRING_APPROVAL,
			...mcpToolNames
		];

		const tools = {
			...gauzyTools,
			...clientTools,
			...((mcp?.tools as any) ?? {})
		} as any;

		let result: any;
		try {
			result = ai.streamText({
				model,
				instructions,
				messages: await ai.convertToModelMessages(args.messages, {
					tools,
					ignoreIncompleteToolCalls: true
				}).catch((error: unknown) => {
					// Malformed UI messages are a client error, not a server fault.
					throw new BadRequestException(
						`Invalid chat messages payload: ${error instanceof Error ? error.message : error}`
					);
				}),
				tools,
				stopWhen: ai.isStepCount(MAX_STEPS),
				toolApproval: Object.fromEntries(approvalRequired.map((name) => [name, 'user-approval'])),
				onEnd: async () => {
					await mcp?.close();
				},
				onError: (error: unknown) => {
					this.logger.error(`streamText error: ${error instanceof Error ? error.message : error}`);
				}
			} as any);
		} catch (error) {
			// Setup failed before streaming started — don't leak the MCP client.
			await mcp?.close();
			throw error;
		}

		// Capture identity now — the request context is gone by stream end.
		const persistFor = {
			userId: RequestContext.currentUserId() ?? undefined,
			tenantId: requestDefaults.tenantId,
			organizationId: requestDefaults.organizationId
		};

		ai.pipeUIMessageStreamToResponse({
			response: args.response,
			stream: ai.toUIMessageStream({
				stream: (result as any).stream,
				// Keeps message ids stable across tool-call round-trips.
				originalMessages: args.messages,
				onEnd: async ({ messages }: { messages: UIMessage[] }) => {
					if (!args.conversationId || !persistFor.userId || !persistFor.tenantId) return;
					try {
						await this.conversationService.saveTurn({
							conversationId: args.conversationId,
							userId: persistFor.userId,
							tenantId: persistFor.tenantId,
							organizationId: persistFor.organizationId,
							messages
						});
					} catch (error) {
						this.logger.warn(
							`Failed to persist conversation ${args.conversationId}: ${
								error instanceof Error ? error.message : error
							}`
						);
					}
				}
			} as any)
		} as any);
	}

	/**
	 * Runtime config for the current tenant — which providers are usable,
	 * which is the default, which models exist. Never exposes secrets.
	 */
	async getConfig(): Promise<IAiChatConfig> {
		const definitions = AiProviderRegistry.list();
		const providers: IAiChatProvider[] = [];

		for (const definition of definitions) {
			const credentials = await this.resolveCredentials(definition);
			providers.push({
				id: definition.id,
				label: definition.label,
				models: definition.models,
				configured: credentials !== null,
				...(credentials ? { credentialSource: credentials.source } : {}),
				...(definition.order !== undefined ? { order: definition.order } : {}),
				...(definition.websiteUrl ? { websiteUrl: definition.websiteUrl } : {}),
				...(definition.apiKeysUrl ? { apiKeysUrl: definition.apiKeysUrl } : {}),
				...(definition.connect
					? { connectType: definition.connect.type, connectAuthorizeUrl: definition.connect.authorizeUrl }
					: {})
			});
		}

		const globallyDisabled = process.env.GAUZY_AI_CHAT_ENABLED === 'false';
		const configured = providers.filter((provider) => provider.configured);
		const defaults = await this.resolveDefaultProvider(configured.map((p) => p.id));

		return {
			enabled: !globallyDisabled && configured.length > 0,
			providers,
			...(defaults ?? {})
		};
	}

	// ── Provider / model resolution ─────────────────────────────────

	private async resolveModel(
		requestedProviderId?: string,
		requestedModelId?: string
	): Promise<{ model: LanguageModel; providerId: string; modelId: string }> {
		const definitions = AiProviderRegistry.list();
		if (!definitions.length) {
			throw new ServiceUnavailableException('No AI providers are registered.');
		}

		let definition: IAiChatProviderDefinition | undefined;
		if (requestedProviderId) {
			definition = AiProviderRegistry.get(requestedProviderId);
			if (!definition) {
				throw new BadRequestException(`Unknown AI provider '${requestedProviderId}'.`);
			}
		} else {
			const defaults = await this.resolveDefaultProvider(definitions.map((d) => d.id));
			definition = defaults ? AiProviderRegistry.get(defaults.defaultProvider) : undefined;
			// Last resort: first provider that has credentials.
			if (!definition) {
				for (const candidate of definitions) {
					if (await this.resolveCredentials(candidate)) {
						definition = candidate;
						break;
					}
				}
			}
		}

		if (!definition) {
			throw new ServiceUnavailableException(
				'AI chat is not configured: no provider has credentials (tenant settings or server environment).'
			);
		}

		const credentials = await this.resolveCredentials(definition);
		if (!credentials) {
			throw new ServiceUnavailableException(`AI provider '${definition.id}' has no usable credentials.`);
		}

		const tenantCredential = await this.getTenantCredential(definition.id);
		const modelId =
			requestedModelId ||
			tenantCredential?.defaultModel ||
			process.env.GAUZY_AI_CHAT_DEFAULT_MODEL ||
			definition.defaultModel;

		const model = await definition.createModel(modelId, credentials);
		return { model, providerId: definition.id, modelId };
	}

	/** Tenant BYOK credential first, then server environment variables. */
	private async resolveCredentials(definition: IAiChatProviderDefinition): Promise<IAiProviderCredentials | null> {
		const tenantCredential = await this.getTenantCredential(definition.id);
		if (tenantCredential?.apiKey) {
			return {
				apiKey: tenantCredential.apiKey,
				baseUrl: tenantCredential.baseUrl ?? undefined,
				source: 'tenant'
			};
		}
		for (const envVar of definition.apiKeyEnvVars) {
			const apiKey = process.env[envVar];
			if (apiKey) {
				return {
					apiKey,
					baseUrl: definition.baseUrlEnvVar ? process.env[definition.baseUrlEnvVar] : undefined,
					source: 'environment'
				};
			}
		}
		return null;
	}

	private async getTenantCredential(providerId: string) {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) return null;
		try {
			return await this.credentialService.getDecryptedCredential(providerId, tenantId);
		} catch (error) {
			this.logger.warn(`Failed to read tenant credential for '${providerId}': ${error}`);
			return null;
		}
	}

	/** Tenant default provider (BYOK `isDefault`) → env default → first configured. */
	private async resolveDefaultProvider(
		configuredIds: string[]
	): Promise<{ defaultProvider: string; defaultModel?: string } | null> {
		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			try {
				const tenantDefault = await this.credentialService.getTenantDefault(tenantId);
				if (tenantDefault && configuredIds.includes(tenantDefault.providerId)) {
					return {
						defaultProvider: tenantDefault.providerId,
						...(tenantDefault.defaultModel ? { defaultModel: tenantDefault.defaultModel } : {})
					};
				}
			} catch {
				/* fall through to env default */
			}
		}

		const envDefault = process.env.GAUZY_AI_CHAT_DEFAULT_PROVIDER;
		if (envDefault && configuredIds.includes(envDefault)) {
			return {
				defaultProvider: envDefault,
				...(process.env.GAUZY_AI_CHAT_DEFAULT_MODEL
					? { defaultModel: process.env.GAUZY_AI_CHAT_DEFAULT_MODEL }
					: {})
			};
		}

		const first = configuredIds[0];
		if (!first) return null;
		const definition = AiProviderRegistry.get(first);
		return { defaultProvider: first, ...(definition ? { defaultModel: definition.defaultModel } : {}) };
	}
}
