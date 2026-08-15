import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import type { UIMessage, LanguageModel } from 'ai';
import {
	AI_CHAT_SETTINGS_PATH,
	AiSpeechErrorCode,
	IAiChatConfig,
	IAiChatModel,
	IAiChatModelCatalogue,
	IAiChatProvider,
	IAiSpeechErrorBody
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { loadAiSdk } from './esm-loader';
import { AiProviderRegistry } from './provider-registry';
import { IAiChatProviderDefinition, IAiProviderCredentials } from './provider.types';
import { isSpeechProviderError } from './speech/speech-provider-error';
import { buildSystemPrompt } from './system-prompt';
import { GauzyApiClient } from './tools/gauzy-api-client';
import { buildGauzyTools, GAUZY_TOOLS_REQUIRING_APPROVAL } from './tools/gauzy-tools';
import { buildClientTools, CLIENT_TOOLS_REQUIRING_APPROVAL } from './tools/client-tools';
import { createMcpTools } from './tools/mcp-tools';
import { createDeferredDataPartWriter } from './tools/data-parts';
import { AiChatToolRegistry } from './tools/tool-registry';
import { AiProviderCredentialService } from './credentials/ai-provider-credential.service';
import { AiChatConversationService } from './conversations/ai-chat-conversation.service';
import { buildRateLimitEnvelope, isRateLimitError, rateLimitRetryAfter, RATE_LIMIT_CODE } from './rate-limit';

/**
 * Largest dictation upload accepted, matching what the upstream speech APIs take anyway.
 *
 * Audio is user-supplied and otherwise bounded only by how long someone holds the button.
 * Exported so the controller can declare the SAME cap as a multer `limits` on the route — one
 * constant, two enforcement points that cannot drift.
 */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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
		const { model, providerId, modelId, credentialSource } = await this.resolveModel(args.providerId, args.modelId);

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
		// Contributed tools may push custom `data-*` parts at the browser (e.g. the Documents
		// plugin's citation chips). The real stream writer only exists inside
		// `createUIMessageStream`'s execute callback below, which runs AFTER the tool map has to
		// be built — so factories get this buffering writer now and it is bound there.
		const dataParts = createDeferredDataPartWriter();
		// Contributions from OTHER plugins (e.g. @gauzy/plugin-docs' docs_search/docs_read),
		// resolved through the static AiChatToolRegistry. resolveAll() is error-isolated per
		// factory and returns an empty contribution when nothing is registered, so behavior is
		// unchanged on installs without contributing plugins.
		const [gauzyTools, clientTools, mcp, registryContribution] = await Promise.all([
			buildGauzyTools(apiClient, requestDefaults),
			buildClientTools(),
			createMcpTools(args.authorizationHeader),
			AiChatToolRegistry.resolveAll({
				writeData: dataParts.write,
				tenantId: requestDefaults.tenantId,
				organizationId: requestDefaults.organizationId,
				employeeId: requestDefaults.employeeId,
				userId: RequestContext.currentUserId() ?? undefined,
				authorizationHeader: args.authorizationHeader,
				languageCode: args.languageCode
			})
		]);

		const instructions = buildSystemPrompt({
			userName: user?.name,
			roleName: (user as any)?.role?.name,
			employeeId: user?.employeeId ?? undefined,
			languageCode: args.languageCode
		});

		const mcpToolNames = Object.keys((mcp?.tools as object) ?? {});

		// Registry contributions merge FIRST so the engine's own tools always win a name
		// collision — a plugin must never be able to shadow a built-in tool.
		const tools = {
			...registryContribution.tools,
			...gauzyTools,
			...clientTools,
			...((mcp?.tools as any) ?? {})
		} as any;

		// MCP tools are external — we cannot know which ones mutate state, so
		// EVERY MCP tool requires the user's explicit in-chat approval.
		// Registry approval names count only when the registry's tool actually survived the
		// merge (a built-in that shadows it carries its own approval policy).
		const registryApproval = (registryContribution.requireApproval ?? []).filter(
			(name) => tools[name] === registryContribution.tools[name]
		);
		const approvalRequired = [
			...GAUZY_TOOLS_REQUIRING_APPROVAL,
			...CLIENT_TOOLS_REQUIRING_APPROVAL,
			...mcpToolNames,
			...registryApproval
		];

		let result: any;
		try {
			result = ai.streamText({
				model,
				instructions,
				messages: await ai
					.convertToModelMessages(args.messages, {
						tools,
						ignoreIncompleteToolCalls: true
					})
					.catch((error: unknown) => {
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

		/**
		 * Let ONLY rate limits through, as structured JSON.
		 *
		 * Without an onError the SDK substitutes the constant "An error occurred." for every
		 * failure, so a 429 — the defining failure of a free tier — reached the browser
		 * indistinguishable from a bug. Widening that mask generally would leak provider
		 * internals, so everything else keeps the generic string; this is also used for
		 * tool-output-error text, which the same selectivity handles correctly.
		 *
		 * Hoisted to a const because BOTH streams below need it: the inner model stream and the
		 * outer wrapper each mask independently, and leaving the wrapper on its default would
		 * re-flatten a rate-limit envelope that failed on the wrapper's side.
		 */
		const maskError = (error: unknown): string => {
			if (!isRateLimitError(error)) return 'An error occurred.';
			const retryAfterSeconds = rateLimitRetryAfter(error);
			return buildRateLimitEnvelope({
				code: RATE_LIMIT_CODE,
				providerId,
				credentialSource,
				...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
			});
		};

		// The model stream, exactly as before — ids stay stable across tool-call round-trips and
		// the finished turn is persisted here.
		const modelStream = ai.toUIMessageStream({
			stream: (result as any).stream,
			// Keeps message ids stable across tool-call round-trips.
			originalMessages: args.messages,
			onError: maskError,
			onEnd: async ({ messages }: { messages: UIMessage[] }) => {
				// The turn is over: later data-part writes would throw into a closed controller.
				dataParts.release();
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
		} as any);

		// Wrapped in a UI message stream so contributed tools can also write custom `data-*`
		// parts onto the SAME assistant message (citation chips and the like). The wrapper only
		// merges the model stream through — every chunk, id and callback above is unchanged — so
		// an install with no contributing plugin streams byte-identical output.
		ai.pipeUIMessageStreamToResponse({
			response: args.response,
			stream: ai.createUIMessageStream({
				onError: maskError,
				execute: ({ writer }: { writer: any }) => {
					// Bound BEFORE the merge: a tool can emit its first data part as soon as the
					// model calls it, which happens inside the stream being merged.
					dataParts.bind(writer);
					writer.merge(modelStream);
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
		// Speech-capable providers whose credentials resolve — what `speechConfigured` reports. Kept
		// separate from `configured`, which is the CHAT verdict: an STT-only provider (Deepgram, a local
		// whisper server) is `chatCapable: false` and so never "configured" for chat, yet is exactly
		// what makes dictation work.
		const speechReady: string[] = [];

		for (const definition of definitions) {
			const credentials = await this.resolveCredentials(definition);
			const speechCapable = typeof definition.transcribe === 'function';
			if (speechCapable && credentials) {
				speechReady.push(definition.id);
			}
			// Narrow the advertised models SERVER-side when the shared free key is in play, so the
			// settings chips, the default-model select and the playground selector all follow with no
			// frontend change — and so the UI never offers a model resolveModel would then reject.
			const platformModels = credentials ? await this.resolvePlatformModels(definition, credentials) : null;
			providers.push({
				id: definition.id,
				label: definition.label,
				models: platformModels ?? definition.models,
				// "Configured" must mean USABLE. A placeholder provider whose createModel throws is not,
				// however many credentials resolve for it — otherwise /config advertises it, the
				// settings UI shows it as ready, and it can be chosen as the tenant default.
				configured: credentials !== null && definition.chatCapable !== false,
				// Surfaced separately from `configured` so the UI can distinguish "save a key" (fixable
				// by the user) from "chat is not implemented for this provider yet" (not fixable by any
				// key). Only ever emitted as false — absent means capable.
				...(definition.chatCapable === false ? { chatCapable: false } : {}),
				...(credentials ? { credentialSource: credentials.source } : {}),
				...(definition.order !== undefined ? { order: definition.order } : {}),
				...(definition.websiteUrl ? { websiteUrl: definition.websiteUrl } : {}),
				...(definition.apiKeysUrl ? { apiKeysUrl: definition.apiKeysUrl } : {}),
				...(definition.connect
					? { connectType: definition.connect.type, connectAuthorizeUrl: definition.connect.authorizeUrl }
					: {}),
				// Voice / speech-to-text surface. `speechCapable` is derived from the hook's presence, so
				// a provider cannot advertise speech it does not implement.
				speechCapable,
				...(speechCapable && definition.speech?.models?.length ? { speechModels: definition.speech.models } : {}),
				...(speechCapable && definition.speech?.defaultModel
					? { defaultSpeechModel: definition.speech.defaultModel }
					: {}),
				requiresApiKey: definition.requiresApiKey !== false,
				...(definition.local ? { local: true } : {}),
				...(definition.defaultBaseUrl ? { defaultBaseUrl: definition.defaultBaseUrl } : {}),
				...(definition.requiresBaseUrl ? { requiresBaseUrl: true } : {})
			});
		}

		const globallyDisabled = process.env.GAUZY_AI_CHAT_ENABLED === 'false';
		const configured = providers.filter((provider) => provider.configured);
		const defaults = await this.resolveDefaultProvider(configured.map((p) => p.id));
		const voiceDefault = await this.resolveVoiceDefault(speechReady);

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
			...(defaults ?? {}),
			speechConfigured: speechReady.length > 0,
			...(voiceDefault ? { defaultVoiceProvider: voiceDefault.providerId } : {})
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
			// The capability gate must hold on the EXPLICIT path too, not only when defaulting. The
			// default path below filters placeholders out, but a request that names one directly —
			// easy to send once /config advertises the provider, and reachable whenever a tenant has
			// saved a BYOK key for it — would sail through to createModel() and surface its raw
			// not-implemented error as a failed turn. Same controlled 503 either way.
			if (definition.chatCapable === false) {
				throw new ServiceUnavailableException(
					`AI provider '${definition.label}' cannot serve chat yet — select another provider.`
				);
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
			// Credentials alone are not enough: a placeholder provider whose createModel still throws
			// must never be defaulted to, and emptying its env vars does not achieve that because a
			// tenant BYOK credential is resolved FIRST. Gate on the capability too.
			//
			// Resolved in parallel — these are independent, and each one can cost a database read plus
			// a decryption, so doing them in series put up to one round trip per registered provider on
			// the critical path of every chat request.
			const selectable = definitions.filter((candidate) => candidate.chatCapable !== false);
			const configured = (
				await Promise.all(
					selectable.map(async (candidate) => ((await this.resolveCredentials(candidate)) ? candidate : null))
				)
			).filter((candidate): candidate is IAiChatProviderDefinition => candidate !== null);
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
		const keyOptional = definition.requiresApiKey === false;
		const tenantCredential = await this.getTenantCredential(definition.id);
		// A key-less tenant row only counts for providers that run without one — the credential service
		// already returns `null` for a key-less row of any other provider, so `apiKey === ''` here IS
		// the local-server case.
		if (tenantCredential && (tenantCredential.apiKey || keyOptional)) {
			return {
				apiKey: tenantCredential.apiKey ?? '',
				baseUrl: tenantCredential.baseUrl ?? definition.defaultBaseUrl ?? undefined,
				source: 'tenant'
			};
		}
		const envBaseUrl = definition.baseUrlEnvVar ? process.env[definition.baseUrlEnvVar] : undefined;
		for (const envVar of definition.apiKeyEnvVars) {
			const apiKey = process.env[envVar];
			if (apiKey) {
				return {
					apiKey,
					baseUrl: envBaseUrl ?? definition.defaultBaseUrl ?? undefined,
					source: 'environment'
				};
			}
		}
		if (definition.platformApiKeyEnvVar) {
			const apiKey = process.env[definition.platformApiKeyEnvVar];
			if (apiKey) {
				return {
					apiKey,
					baseUrl: envBaseUrl ?? definition.defaultBaseUrl ?? undefined,
					source: 'platform'
				};
			}
		}
		// A local server is "configured" the moment the operator points at it — a base URL in the
		// environment is the whole credential. Providers with a conventional default address
		// (Speaches, LocalAI, whisper.cpp) are NOT auto-configured from that default alone: the tenant
		// or operator has to opt in, or every install would advertise dictation through a server that
		// is not running.
		if (keyOptional && envBaseUrl) {
			return { apiKey: '', baseUrl: envBaseUrl, source: 'environment' };
		}
		return null;
	}

	/**
	 * The provider's model catalogue for the settings picker.
	 *
	 * Deliberately NOT folded into getConfig(): that endpoint is fetched at app bootstrap for every
	 * user with chat access and already loops every registered provider, so keyed upstream calls there
	 * would put the app shell behind six third-party APIs on every login. This is called lazily, for
	 * one provider, when its config view opens.
	 *
	 * DISPLAY ONLY, and it fails OPEN: any error degrades to the provider's curated list. A settings
	 * page that cannot show a dropdown because a vendor is having a bad day is a worse outcome than a
	 * slightly short list.
	 */
	async listProviderModels(providerId: string): Promise<IAiChatModelCatalogue> {
		const definition = AiProviderRegistry.get(providerId);
		if (!definition) {
			throw new BadRequestException(`Unknown AI provider '${providerId}'.`);
		}
		// A placeholder provider has nothing to offer; say so explicitly rather than reporting a
		// failed fetch.
		if (definition.chatCapable === false) {
			return { providerId, models: [], source: 'curated' };
		}

		const credentials = await this.resolveCredentials(definition);

		// On the shared free key the picker must show EXACTLY the enforced allowlist. Anything wider
		// and the UI offers models that resolveModel() then rejects — the same advertise-then-refuse
		// asymmetry that made AI chat look configured while every turn failed.
		const platformModels = credentials ? await this.resolvePlatformModels(definition, credentials) : null;
		if (platformModels) {
			return { providerId, models: platformModels, source: 'platform' };
		}

		if (!definition.listModels) {
			return { providerId, models: definition.models, source: 'curated' };
		}
		try {
			const listed = await definition.listModels(credentials);
			// The hook reports its own source, rather than this inferring `live` from "the array is not
			// empty". Those are different questions: a provider with no key yet, and a provider whose
			// fetch failed, both return a perfectly non-empty CURATED list — and calling that live left
			// the settings page unable to say "save an API key to load the full list", which is the one
			// thing the user needs to hear at that moment.
			return listed.models.length
				? {
						providerId,
						models: listed.models,
						source: listed.source,
						...(listed.stale ? { stale: true } : {})
					}
				: { providerId, models: definition.models, source: 'curated' };
		} catch (error) {
			this.logger.warn(
				`[ai-chat] Model catalogue fetch failed for '${providerId}'; serving the curated list: ` +
					`${error instanceof Error ? error.message : error}`
			);
			return { providerId, models: definition.models, source: 'curated' };
		}
	}

	/**
	 * Transcribe recorded speech for the chat's dictation control.
	 *
	 * Order of attempts:
	 *
	 * 1. the tenant's VOICE DEFAULT (the credential flagged `isVoiceDefault`), when that provider can
	 *    transcribe and its credentials resolve;
	 * 2. then every other registered provider that CAN transcribe, in display order, using the first
	 *    one the tenant actually has a credential for.
	 *
	 * Dictation is a property of the workspace, not of the chat model: a tenant whose chat runs on
	 * Anthropic (no speech model) should still be able to dictate if they also have an OpenAI key or a
	 * local whisper server, without being told to go and change their chat provider. The pinned voice
	 * default is what lets a tenant say "always this one" (mirrors the operator-pinned transcription
	 * provider with capable-fallback model of ever-works).
	 *
	 * Failures throw a 503 whose body is an OBJECT — `{ message, code, settingsPath }` — so the chat
	 * client can render an actionable, translated message with a link to the AI Providers page, while
	 * old clients still find a readable `message`.
	 *
	 * @param audio Bytes as recorded by the browser.
	 * @param mimeType Container the browser produced.
	 * @param options Optional language hint forwarded to the provider.
	 * @returns The transcript, which may legitimately be empty for silence.
	 */
	async transcribe(audio: Buffer, mimeType: string, options?: { language?: string }): Promise<string> {
		if (!audio?.length) {
			throw new BadRequestException('No audio was uploaded.');
		}
		// Second line of defense. The route declares the same MAX_AUDIO_BYTES as a multer `limits`,
		// which rejects an oversized upload BEFORE memoryStorage buffers it — but this check stays:
		// it guards any future caller that does not arrive through that interceptor, and it survives
		// the interceptor's history of silently dropping options (forwarding `limits` at all is a fix
		// from this same change; for a while a declared cap read as enforced while holding nothing).
		if (audio.length > MAX_AUDIO_BYTES) {
			throw new BadRequestException(
				`Recording is too large (${Math.round(audio.length / 1024 / 1024)}MB). The limit is ${
					MAX_AUDIO_BYTES / 1024 / 1024
				}MB.`
			);
		}

		const capable = AiProviderRegistry.list()
			.filter((definition) => typeof definition.transcribe === 'function')
			.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

		if (!capable.length) {
			throw this.speechUnavailable(
				AiSpeechErrorCode.NOT_CONFIGURED,
				'No AI provider on this server can transcribe speech — install a speech-capable provider plugin.'
			);
		}

		// The voice default goes FIRST; the rest keep their display order.
		const voiceDefault = await this.resolveVoiceDefault(capable.map((definition) => definition.id));
		const ordered = voiceDefault
			? [
					...capable.filter((definition) => definition.id === voiceDefault.providerId),
					...capable.filter((definition) => definition.id !== voiceDefault.providerId)
				]
			: capable;

		// One entry per attempted provider: every attempt either returns out of the function or pushes
		// its failure here, so `failures` doubles as the "was anything attempted" signal at the throw.
		const failures: string[] = [];
		const attempted: string[] = [];
		let keyRejected = false;
		for (const definition of ordered) {
			const credentials = await this.resolveCredentials(definition);
			if (!credentials) continue;
			attempted.push(definition.id);
			// The tenant's speech model for THIS provider (from its credential row), else the provider's
			// own default. Passed through even when unset so a hook can rely on the options object.
			const tenantCredential = await this.getTenantCredential(definition.id);
			const model = tenantCredential?.speechModel || definition.speech?.defaultModel;
			try {
				return await definition.transcribe(audio, mimeType, credentials, {
					...(model ? { model } : {}),
					...(options?.language ? { language: options.language } : {})
				});
			} catch (error) {
				// Try the next provider rather than failing the whole dictation on one bad key.
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`[ai-chat] Transcription via '${definition.id}' failed: ${message}`);
				// Typed classification from the shared speech helper — no regex over prose. A provider
				// hook that throws a plain Error is simply "failed"; it never gets to look like a key
				// problem by accident.
				if (isSpeechProviderError(error) && error.kind === 'key-rejected') {
					keyRejected = true;
				}
				// Boundary defense for the user-visible join below: an empty Error message or a thrown
				// non-Error ('[object Object]') would otherwise put a blank or noise where the old text
				// at least named the provider — so fall back to naming it, and bound the length here
				// rather than trusting every provider hook to.
				const usable = message.trim() && message !== '[object Object]';
				failures.push(usable ? message.slice(0, 400) : `Transcription via '${definition.id}' failed.`);
			}
		}

		if (!failures.length) {
			// Nothing was even attempted: no speech-capable provider has credentials for this tenant.
			throw this.speechUnavailable(
				AiSpeechErrorCode.NOT_CONFIGURED,
				`Dictation needs a voice provider. Add one (${capable
					.slice(0, 4)
					.map((definition) => definition.label)
					.join(', ')}${capable.length > 4 ? ', …' : ''}) on the AI Providers settings page.`
			);
		}

		// The chat panel shows this message verbatim, so it must not over-diagnose. Relay what the
		// provider hook actually reported (providers classify by status and never echo a response
		// body), and point at Settings only when a provider actually rejected the credential.
		const detail = failures.join('; ').replace(/[.\s]+$/, '');
		throw this.speechUnavailable(
			keyRejected ? AiSpeechErrorCode.KEY_REJECTED : AiSpeechErrorCode.FAILED,
			`${detail}.${keyRejected ? ' Update the key on the AI Providers settings page.' : ''}`,
			attempted
		);
	}

	/**
	 * Build the 503 thrown by {@link transcribe}: a structured body the client can branch on, with a
	 * human-readable `message` for clients that only read that.
	 */
	private speechUnavailable(
		code: AiSpeechErrorCode,
		message: string,
		attemptedProviders?: string[]
	): ServiceUnavailableException {
		const body: IAiSpeechErrorBody = {
			message,
			code,
			settingsPath: AI_CHAT_SETTINGS_PATH,
			...(attemptedProviders?.length ? { attemptedProviders } : {})
		};
		return new ServiceUnavailableException(body);
	}

	/**
	 * The tenant's pinned voice (dictation) provider, if it is among `capableIds`.
	 *
	 * @param capableIds Provider ids eligible right now (speech-capable, and — for `/config` —
	 *                   with resolvable credentials).
	 */
	private async resolveVoiceDefault(capableIds: string[]): Promise<{ providerId: string; speechModel?: string } | null> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) return null;
		try {
			const voiceDefault = await this.credentialService.getTenantVoiceDefault(tenantId);
			return voiceDefault && capableIds.includes(voiceDefault.providerId) ? voiceDefault : null;
		} catch (error) {
			this.logger.warn(`Failed to read tenant voice default: ${error instanceof Error ? error.message : error}`);
			return null;
		}
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
