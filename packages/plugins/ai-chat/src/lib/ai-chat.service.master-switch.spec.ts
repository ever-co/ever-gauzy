import { ServiceUnavailableException } from '@nestjs/common';

// Same module-boundary stubs as ai-chat.service.capability.spec.ts: @gauzy/core pulls the whole
// bootstrap and the tool builders pull the ESM-only `ai` SDK.
jest.mock('@gauzy/core', () => ({ RequestContext: { currentTenantId: () => undefined } }));
jest.mock('./esm-loader', () => ({ loadAiSdk: jest.fn() }));
jest.mock('./tools/gauzy-api-client', () => ({ GauzyApiClient: class {} }));
jest.mock('./tools/gauzy-tools', () => ({ buildGauzyTools: jest.fn(), GAUZY_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/client-tools', () => ({ buildClientTools: jest.fn(), CLIENT_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/mcp-tools', () => ({ createMcpTools: jest.fn() }));
jest.mock('./credentials/ai-provider-credential.service', () => ({ AiProviderCredentialService: class {} }));
jest.mock('./conversations/ai-chat-conversation.service', () => ({ AiChatConversationService: class {} }));

import { loadAiSdk } from './esm-loader';
import { AiProviderRegistry } from './provider-registry';
import { AiChatService, IStreamChatArgs, isAiChatGloballyDisabled } from './ai-chat.service';
import { IAiChatProviderDefinition } from './provider.types';

/**
 * `GAUZY_AI_CHAT_ENABLED=false` is the operator's master switch. `/config` reporting it is not
 * enough: the UI hides itself on that verdict, but any client can still POST a chat turn or a
 * dictation, and both reach a paid provider. Each test fails if its route's gate is removed.
 */
describe('AiChatService master switch (GAUZY_AI_CHAT_ENABLED)', () => {
	const original = process.env.GAUZY_AI_CHAT_ENABLED;

	const transcribe = jest.fn(async () => 'transcript');
	const provider: IAiChatProviderDefinition = {
		id: 'test-provider',
		label: 'Test Provider',
		apiKeyEnvVars: ['TEST_PROVIDER_API_KEY'],
		models: [{ id: 'test-model', label: 'Test Model', providerId: 'test-provider' }],
		defaultModel: 'test-model',
		order: 50,
		transcribe,
		async createModel() {
			return {} as never;
		}
	};

	/** Service with the DB-touching privates stubbed; the provider resolves from the environment. */
	const service = (): AiChatService => {
		const instance = new AiChatService(null as never, null as never);
		(instance as unknown as { getTenantCredential: unknown }).getTenantCredential = async () => null;
		(instance as unknown as { resolveDefaultProvider: unknown }).resolveDefaultProvider = async () => null;
		(instance as unknown as { resolveVoiceDefault: unknown }).resolveVoiceDefault = async () => null;
		return instance;
	};

	const chatArgs = (): IStreamChatArgs => ({
		messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] as IStreamChatArgs['messages'],
		authorizationHeader: 'Bearer token',
		response: {} as IStreamChatArgs['response']
	});

	beforeEach(() => {
		AiProviderRegistry.clear();
		AiProviderRegistry.register(provider);
		process.env.TEST_PROVIDER_API_KEY = 'env-key';
		(loadAiSdk as jest.Mock).mockClear();
		transcribe.mockClear();
	});

	afterEach(() => {
		if (original === undefined) {
			delete process.env.GAUZY_AI_CHAT_ENABLED;
		} else {
			process.env.GAUZY_AI_CHAT_ENABLED = original;
		}
	});

	afterAll(() => {
		AiProviderRegistry.clear();
		delete process.env.TEST_PROVIDER_API_KEY;
	});

	it('treats only an explicit "false" (any case, trimmed) as off', () => {
		for (const value of ['false', 'FALSE', ' False ']) {
			process.env.GAUZY_AI_CHAT_ENABLED = value;
			expect(isAiChatGloballyDisabled()).toBe(true);
		}
		for (const value of [undefined, '', 'true', '0', 'no']) {
			if (value === undefined) delete process.env.GAUZY_AI_CHAT_ENABLED;
			else process.env.GAUZY_AI_CHAT_ENABLED = value;
			expect(isAiChatGloballyDisabled()).toBe(false);
		}
	});

	it('refuses a chat turn with a 503 before loading the SDK or resolving a model', async () => {
		process.env.GAUZY_AI_CHAT_ENABLED = 'false';

		await expect(service().streamChat(chatArgs())).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(loadAiSdk).not.toHaveBeenCalled();
	});

	it('refuses a dictation with a 503 without calling the speech provider', async () => {
		process.env.GAUZY_AI_CHAT_ENABLED = 'false';

		await expect(service().transcribe(Buffer.from('audio'), 'audio/webm')).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
		expect(transcribe).not.toHaveBeenCalled();
	});

	it('still transcribes when the switch is on — the gate is the only thing that changed', async () => {
		process.env.GAUZY_AI_CHAT_ENABLED = 'true';

		await expect(service().transcribe(Buffer.from('audio'), 'audio/webm')).resolves.toBe('transcript');
		expect(transcribe).toHaveBeenCalledTimes(1);
	});

	it('reports the same verdict on /config', async () => {
		process.env.GAUZY_AI_CHAT_ENABLED = 'FALSE';

		const config = await service().getConfig();

		expect(config.enabled).toBe(false);
		expect(config.disabledReason).toBe('globally-disabled');
	});
});
