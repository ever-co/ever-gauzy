import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import type { UIMessage, LanguageModel } from 'ai';
import { IAiChatConfig, IAiChatModel, IAiChatProvider } from '@gauzy/contracts';
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
import { buildRateLimitEnvelope, isRateLimitError, rateLimitRetryAfter, RATE_LIMIT_CODE } from './rate-limit';

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
		const { model, providerId, modelId, credentialSource } = await this.resolveModel(
			args.providerId,
			args.modelId
		);

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
				// AI SDK 7 invokes this as `onError({ error })`, NOT `onError(error)`. Typed as
				// `(error: unknown)` and stringified, every provider failure logged as
				// "[object Object]" — the `as any` on this options object is why tsc never said so.
				onError: (event: unknown) => {
					const error = (event as { error?: unknown })?.error ?? event;
					this.logger.error(
						`streamText error [provider=${providerId} model=${modelId} credential=${credentialSource}]: ` +
							`${error instanceof Error ? error.message : JSON.stringify(error)}`
					);
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
				/**
				 * Let ONLY rate limits through, as structured JSON.
				 *
				 * Without an onError the SDK substitutes the constant "An error occurred." for every
				 * failure, so a 429 — the defining failure of a free tier — reached the browser
				 * indistinguishable from a bug. Widening that mask generally would leak provider
				 * internals, so everything else keeps the generic string; this is also used for
				 * tool-output-error text, which the same selectivity handles correctly.
				 */
				onError: (error: unknown) => {
					if (!isRateLimitError(error)) return 'An error occurred.';
					const retryAfterSeconds = rateLimitRetryAfter(error);
					return buildRateLimitEnvelope({
						code: RATE_LIMIT_CODE,
						providerId,
						credentialSource,
						...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
					});
				},
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
			// Narrow the advertised models SERVER-side when the shared free key is in play, so the
			// settings chips, the default-model select and the playground selector all follow with no
			// frontend change — and so the UI never offers a model resolveModel would then reject.
			const platformModels = credentials ? await this.resolvePlatformModels(definition, credentials) : null;
			providers.push({
				id: definition.id,
				label: definition.label,
				models: platformModels ?? definition.models,
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

		// Report WHICH gate is closed: the chat is hidden client-side when this is
		// false, and without a reason the user cannot tell "nobody configured a
		// provider yet" from "an operator switched the whole feature off".
		let disabledReason: IAiChatConfig['disabledReason'];
		if (globallyDisabled) {
			disabledReason = 'globally-disabled';
		} else if (!configured.length) {
			disabledReason = 'no-providers';
		}

		return {
			enabled: !globallyDisabled && configured.length > 0,
			...(disabledReason ? { disabledReason } : {}),
			providers,
			...(defaults ?? {})
		};
	}

	// ── Provider / model resolution ─────────────────────────────────

	private async resolveModel(
		requestedProviderId?: string,
		requestedModelId?: string
	): Promise<{
		model: LanguageModel;
		providerId: string;
		modelId: string;
		credentialSource: IAiProviderCredentials['source'];
	}> {
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
			// Only a provider that actually HAS credentials may be defaulted to.
			//
			// This used to pass every REGISTERED provider — `definitions.map(d => d.id)` — while
			// getConfig() (above) correctly passes only the configured ones. That asymmetry was a
			// live outage: resolveDefaultProvider's last step is `const first = configuredIds[0]`,
			// returned WITHOUT a credential check, and AiProviderRegistry.list() sorts ascending by
			// `order`, where gauzy-ai is 10 — always first. So on any install with no tenant-level
			// default, `definition` became gauzy-ai. Being non-null, it also skipped the
			// "first provider that has credentials" search that used to sit here, and the request
			// then died at the `no usable credentials` throw below — or, if GAUZY_AI_API_KEY happened
			// to be set (the unrelated integration-ai plugin shares that exact variable), at
			// gauzy-ai's createModel, which throws 'not implemented yet' unconditionally.
			// Meanwhile GET /config advertised a healthy default, so the UI looked configured and
			// every single turn failed.
			const configured: IAiChatProviderDefinition[] = [];
			for (const candidate of definitions) {
				if (await this.resolveCredentials(candidate)) {
					configured.push(candidate);
				}
			}
			const defaults = await this.resolveDefaultProvider(configured.map((d) => d.id));
			// resolveDefaultProvider already falls back to configuredIds[0], so this covers the
			// old explicit "last resort" loop; it returns null only when nothing is configured.
			definition = defaults ? AiProviderRegistry.get(defaults.defaultProvider) : configured[0];
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

		const platformModels = await this.resolvePlatformModels(definition, credentials);
		if (platformModels) {
			// Running on the shared free key: the model list is an ALLOWLIST, not a suggestion.
			if (!platformModels.length) {
				throw new ServiceUnavailableException(
					`AI provider '${definition.id}' has no free models available right now. ` +
						`Add your own API key in Settings → AI Providers to continue.`
				);
			}
			const allowed = new Set(platformModels.map((m) => m.id));
			if (requestedModelId && !allowed.has(requestedModelId)) {
				// Reject rather than silently substituting: the client's selector only offers allowed
				// ids, so a mismatch means a stale client or a hand-crafted request, and quietly
				// answering from a different model than the caller asked for is its own bug.
				throw new BadRequestException(
					`Model '${requestedModelId}' is not available on the free tier. ` +
						`Choose one of: ${platformModels.map((m) => m.id).join(', ')} — ` +
						`or add your own '${definition.id}' API key in Settings → AI Providers for full access.`
				);
			}
			// GAUZY_AI_CHAT_DEFAULT_MODEL is deliberately NOT consulted here: it is provider-agnostic
			// (.env.sample ships an Anthropic-native slug) and would name a model this provider would
			// reject. A tenant default cannot apply either — a usable tenant credential would have
			// produced source:'tenant' and never reached this branch.
			const modelId = requestedModelId || definition.platformDefaultModel || platformModels[0].id;
			const model = await definition.createModel(modelId, credentials);
			return { model, providerId: definition.id, modelId, credentialSource: credentials.source };
		}

		const tenantCredential = await this.getTenantCredential(definition.id);
		const modelId =
			requestedModelId ||
			tenantCredential?.defaultModel ||
			process.env.GAUZY_AI_CHAT_DEFAULT_MODEL ||
			definition.defaultModel;

		const model = await definition.createModel(modelId, credentials);
		return { model, providerId: definition.id, modelId, credentialSource: credentials.source };
	}

	/**
	 * Tenant BYOK credential, then the operator's own environment key, then the shared platform key.
	 *
	 * The order is the whole design. The platform key is a free tier the product supplies so the AI
	 * agent works with no setup, and it is the ONLY source restricted to free models — so it must be
	 * reached only when nothing else applies. An operator who deliberately sets the provider's own
	 * env var keeps unrestricted access, and a tenant that brings its own key always wins outright.
	 */
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
		if (definition.platformApiKeyEnvVar) {
			const apiKey = process.env[definition.platformApiKeyEnvVar];
			if (apiKey) {
				return {
					apiKey,
					baseUrl: definition.baseUrlEnvVar ? process.env[definition.baseUrlEnvVar] : undefined,
					source: 'platform'
				};
			}
		}
		return null;
	}

	/**
	 * Models permitted for this credential — the full catalogue, or the free subset on the platform
	 * key.
	 *
	 * Returns `null` when there is no restriction, so callers can distinguish "unrestricted" from
	 * "restricted to nothing" (the latter disables the tier rather than silently allowing anything).
	 */
	private async resolvePlatformModels(
		definition: IAiChatProviderDefinition,
		credentials: IAiProviderCredentials
	): Promise<IAiChatModel[] | null> {
		if (credentials.source !== 'platform' || !definition.listPlatformModels) return null;
		try {
			return await definition.listPlatformModels();
		} catch (error) {
			// A provider that cannot list its free models must not fall open onto the shared key.
			this.logger.error(
				`[ai-chat] Could not list platform models for '${definition.id}'; refusing the platform tier.`,
				error instanceof Error ? error.stack : String(error)
			);
			return [];
		}
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
