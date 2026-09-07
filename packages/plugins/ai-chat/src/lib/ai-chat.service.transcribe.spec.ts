import { ServiceUnavailableException } from '@nestjs/common';
import { AiSpeechErrorCode } from '@gauzy/contracts';

// Same module-boundary stubs as ai-chat.service.capability.spec.ts: @gauzy/core pulls the whole
// bootstrap and the tool builders pull the ESM-only `ai` SDK; none of it is on the dictation path.
jest.mock('@gauzy/core', () => ({ RequestContext: { currentTenantId: () => 'tenant-1' } }));
jest.mock('./esm-loader', () => ({ loadAiSdk: jest.fn() }));
jest.mock('./tools/gauzy-api-client', () => ({ GauzyApiClient: class {} }));
jest.mock('./tools/gauzy-tools', () => ({ buildGauzyTools: jest.fn(), GAUZY_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/client-tools', () => ({ buildClientTools: jest.fn(), CLIENT_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/mcp-tools', () => ({ createMcpTools: jest.fn() }));
jest.mock('./credentials/ai-provider-credential.service', () => ({ AiProviderCredentialService: class {} }));
jest.mock('./conversations/ai-chat-conversation.service', () => ({ AiChatConversationService: class {} }));

import { AiProviderRegistry } from './provider-registry';
import { AiChatService } from './ai-chat.service';
import { IAiChatProviderDefinition, IAiProviderCredentials, IAiTranscribeOptions } from './provider.types';
import { SpeechProviderError } from './speech/speech-provider-error';

/**
 * The dictation provider-selection contract:
 *
 *  - the tenant's VOICE DEFAULT is tried first, even when a cheaper provider sorts before it;
 *  - otherwise the speech-capable providers are walked in `order`, skipping the ones without
 *    credentials, and the first success wins;
 *  - the tenant's chosen speech model (from the credential row) is passed through, else the
 *    provider's `speech.defaultModel`;
 *  - nothing configured → 503 with `code: AI_SPEECH_NOT_CONFIGURED` and a `settingsPath`;
 *  - a provider that REJECTED the key → `AI_SPEECH_KEY_REJECTED`; anything else → `AI_SPEECH_FAILED`;
 *  - `/config` reports `speechCapable`, `speechConfigured` and `defaultVoiceProvider`.
 */
describe('AiChatService.transcribe provider selection', () => {
	type Call = { id: string; options?: IAiTranscribeOptions; credentials: IAiProviderCredentials };
	let calls: Call[];

	/** A speech-capable provider whose transcribe records the call and returns `result`. */
	const speechProvider = (
		id: string,
		order: number,
		result: string | Error,
		extra: Partial<IAiChatProviderDefinition> = {}
	): IAiChatProviderDefinition => ({
		id,
		label: id.toUpperCase(),
		apiKeyEnvVars: [`${id.toUpperCase().replace(/-/g, '_')}_API_KEY`],
		models: [],
		defaultModel: '',
		order,
		speech: { models: [{ id: `${id}-stt`, label: 'STT', providerId: id }], defaultModel: `${id}-stt` },
		async transcribe(_audio, _mime, credentials, options) {
			calls.push({ id, options, credentials });
			if (result instanceof Error) throw result;
			return result;
		},
		async createModel() {
			return {} as never;
		},
		...extra
	});

	/** A chat-only provider (no transcribe hook) — must never be attempted. */
	const chatOnly: IAiChatProviderDefinition = {
		id: 'chat-only',
		label: 'Chat Only',
		apiKeyEnvVars: ['CHAT_ONLY_API_KEY'],
		models: [],
		defaultModel: '',
		order: 5,
		async createModel() {
			return {} as never;
		}
	};

	/**
	 * Service with the DB-touching privates stubbed. `tenantRows` maps provider id → the tenant's
	 * credential row (a row means credentials resolve with source 'tenant'); `voiceDefault` is what
	 * the credential service would report as the tenant's `isVoiceDefault` row.
	 */
	const service = (
		tenantRows: Record<string, { apiKey?: string; speechModel?: string; baseUrl?: string }>,
		voiceDefault: { providerId: string; speechModel?: string } | null = null
	): AiChatService => {
		const credentialService = {
			getTenantVoiceDefault: jest.fn(async () => voiceDefault),
			getTenantDefault: jest.fn(async () => null)
		};
		const instance = new AiChatService(credentialService as never, null as never);
		(instance as unknown as { getTenantCredential: unknown }).getTenantCredential = async (providerId: string) => {
			const row = tenantRows[providerId];
			return row ? { apiKey: row.apiKey ?? 'tenant-key', enabled: true, ...row } : null;
		};
		return instance;
	};

	const audio = Buffer.from('fake-audio-bytes');
	const envBackup = { ...process.env };

	beforeEach(() => {
		calls = [];
		AiProviderRegistry.clear();
		// No environment keys leak in from the developer's shell.
		for (const key of Object.keys(process.env)) {
			if (/_API_KEY$|_BASE_URL$/.test(key)) delete process.env[key];
		}
	});

	afterAll(() => {
		AiProviderRegistry.clear();
		process.env = envBackup;
	});

	/** Body of the 503 the service throws. */
	const bodyOf = async (promise: Promise<unknown>) => {
		try {
			await promise;
		} catch (error) {
			expect(error).toBeInstanceOf(ServiceUnavailableException);
			return (error as ServiceUnavailableException).getResponse() as {
				message: string;
				code: string;
				settingsPath: string;
				attemptedProviders?: string[];
			};
		}
		throw new Error('expected transcribe() to reject');
	};

	it('prefers the tenant voice default over a provider that sorts earlier', async () => {
		AiProviderRegistry.register(speechProvider('cheap', 50, 'from cheap'));
		AiProviderRegistry.register(speechProvider('pinned', 110, 'from pinned'));

		const text = await service({ cheap: {}, pinned: {} }, { providerId: 'pinned' }).transcribe(audio, 'audio/webm');

		expect(text).toBe('from pinned');
		expect(calls.map((call) => call.id)).toEqual(['pinned']);
	});

	it('walks the capable providers in order and uses the first one with credentials', async () => {
		AiProviderRegistry.register(chatOnly);
		AiProviderRegistry.register(speechProvider('no-creds', 40, 'never'));
		AiProviderRegistry.register(speechProvider('second', 60, 'from second'));
		AiProviderRegistry.register(speechProvider('first', 50, 'from first'));

		const text = await service({ second: {}, first: {} }).transcribe(audio, 'audio/webm');

		expect(text).toBe('from first');
		// 'no-creds' has no credential and is skipped; 'chat-only' has no hook and is never a candidate.
		expect(calls.map((call) => call.id)).toEqual(['first']);
	});

	it('falls back to the next capable provider when the voice default fails, and reports every attempt', async () => {
		AiProviderRegistry.register(speechProvider('pinned', 110, new Error('pinned is down')));
		AiProviderRegistry.register(speechProvider('backup', 50, 'from backup'));

		const text = await service({ pinned: {}, backup: {} }, { providerId: 'pinned' }).transcribe(audio, 'audio/webm');

		expect(text).toBe('from backup');
		expect(calls.map((call) => call.id)).toEqual(['pinned', 'backup']);
	});

	it('passes the tenant speech model through, else the provider default', async () => {
		AiProviderRegistry.register(speechProvider('withPref', 50, 'ok'));
		AiProviderRegistry.register(speechProvider('withoutPref', 60, 'ok'));

		await service({ withPref: { speechModel: 'tenant-picked' } }).transcribe(audio, 'audio/webm', {
			language: 'de'
		});
		expect(calls[0]).toMatchObject({ id: 'withPref', options: { model: 'tenant-picked', language: 'de' } });

		calls = [];
		await service({ withoutPref: {} }).transcribe(audio, 'audio/webm');
		expect(calls[0]).toMatchObject({ id: 'withoutPref', options: { model: 'withoutPref-stt' } });
	});

	it('answers NOT_CONFIGURED with the settings path when no capable provider has credentials', async () => {
		AiProviderRegistry.register(speechProvider('cloud', 50, 'never'));

		const body = await bodyOf(service({}).transcribe(audio, 'audio/webm'));

		expect(body.code).toBe(AiSpeechErrorCode.NOT_CONFIGURED);
		expect(body.settingsPath).toBe('/pages/settings/ai');
		expect(body.message).toMatch(/voice provider/i);
		expect(calls).toHaveLength(0);
	});

	it('answers NOT_CONFIGURED when no registered provider can transcribe at all', async () => {
		AiProviderRegistry.register(chatOnly);

		const body = await bodyOf(service({ 'chat-only': {} }).transcribe(audio, 'audio/webm'));

		expect(body.code).toBe(AiSpeechErrorCode.NOT_CONFIGURED);
		expect(body.settingsPath).toBe('/pages/settings/ai');
	});

	it('answers KEY_REJECTED only when a provider classified the failure as a rejected credential', async () => {
		AiProviderRegistry.register(
			speechProvider('bad-key', 50, new SpeechProviderError('X transcription failed: the API key was rejected', 'key-rejected'))
		);
		AiProviderRegistry.register(speechProvider('quota', 60, new SpeechProviderError('Y: rate limit', 'rate-limited')));

		const body = await bodyOf(service({ 'bad-key': {}, quota: {} }).transcribe(audio, 'audio/webm'));

		expect(body.code).toBe(AiSpeechErrorCode.KEY_REJECTED);
		expect(body.attemptedProviders).toEqual(['bad-key', 'quota']);
		expect(body.message).toMatch(/API key was rejected/);
		expect(body.message).toMatch(/AI Providers/);
	});

	it('answers FAILED for a plain error, and does not blame the key even if the prose mentions one', async () => {
		// A hook throwing a plain Error whose text happens to say "api key" used to be regex-sniffed
		// into a credential problem. Classification is typed now.
		AiProviderRegistry.register(speechProvider('flaky', 50, new Error('flaky: server exploded near the api key vault')));

		const body = await bodyOf(service({ flaky: {} }).transcribe(audio, 'audio/webm'));

		expect(body.code).toBe(AiSpeechErrorCode.FAILED);
		expect(body.message).toContain('server exploded');
	});

	it('treats a key-less local provider with a base URL as configured', async () => {
		AiProviderRegistry.register(
			speechProvider('local-stt', 100, 'from local', {
				requiresApiKey: false,
				local: true,
				apiKeyEnvVars: ['LOCAL_STT_API_KEY'],
				baseUrlEnvVar: 'LOCAL_STT_BASE_URL',
				defaultBaseUrl: 'http://localhost:8000/v1'
			})
		);

		// Tenant row without a key: the credential service hands it back with apiKey '' for a
		// requiresApiKey:false provider, and the resolver must accept it.
		const text = await service({ 'local-stt': { apiKey: '', baseUrl: 'http://stt.internal:8000/v1' } }).transcribe(
			audio,
			'audio/webm'
		);
		expect(text).toBe('from local');
		expect(calls[0].credentials).toMatchObject({ apiKey: '', baseUrl: 'http://stt.internal:8000/v1', source: 'tenant' });

		// Operator points at it through the environment: also configured, with no key.
		calls = [];
		process.env.LOCAL_STT_BASE_URL = 'http://ops-stt:8000/v1';
		await service({}).transcribe(audio, 'audio/webm');
		expect(calls[0].credentials).toMatchObject({ apiKey: '', baseUrl: 'http://ops-stt:8000/v1', source: 'environment' });

		// But the conventional default address alone does NOT auto-configure it.
		delete process.env.LOCAL_STT_BASE_URL;
		const body = await bodyOf(service({}).transcribe(audio, 'audio/webm'));
		expect(body.code).toBe(AiSpeechErrorCode.NOT_CONFIGURED);
	});

	it('/config reports speech capability, whether dictation is configured, and the voice default', async () => {
		AiProviderRegistry.register(chatOnly);
		AiProviderRegistry.register(
			speechProvider('stt-only', 110, 'ok', {
				chatCapable: false,
				requiresApiKey: false,
				local: true,
				baseUrlEnvVar: 'STT_ONLY_BASE_URL',
				defaultBaseUrl: 'http://localhost:9000'
			})
		);
		AiProviderRegistry.register(speechProvider('both', 50, 'ok'));

		const instance = service({ 'stt-only': { apiKey: '' } }, { providerId: 'stt-only' });
		(instance as unknown as { resolveDefaultProvider: unknown }).resolveDefaultProvider = async () => null;
		const config = await instance.getConfig();
		const byId = new Map(config.providers.map((provider) => [provider.id, provider]));

		expect(byId.get('chat-only')).toMatchObject({ speechCapable: false, requiresApiKey: true });
		expect(byId.get('both')).toMatchObject({
			speechCapable: true,
			requiresApiKey: true,
			defaultSpeechModel: 'both-stt',
			speechModels: [{ id: 'both-stt' }]
		});
		expect(byId.get('stt-only')).toMatchObject({
			speechCapable: true,
			requiresApiKey: false,
			local: true,
			chatCapable: false,
			// Not "configured" for CHAT — it cannot chat — yet it is what makes dictation work.
			configured: false,
			defaultBaseUrl: 'http://localhost:9000'
		});
		expect(config.speechConfigured).toBe(true);
		expect(config.defaultVoiceProvider).toBe('stt-only');
	});

	it('/config reports speechConfigured false and no voice default when nothing capable has credentials', async () => {
		AiProviderRegistry.register(speechProvider('cloud', 50, 'ok'));

		const instance = service({}, { providerId: 'cloud' });
		(instance as unknown as { resolveDefaultProvider: unknown }).resolveDefaultProvider = async () => null;
		const config = await instance.getConfig();

		expect(config.speechConfigured).toBe(false);
		// A stale voice-default row for a provider whose credentials no longer resolve is not advertised.
		expect(config.defaultVoiceProvider).toBeUndefined();
	});
});
