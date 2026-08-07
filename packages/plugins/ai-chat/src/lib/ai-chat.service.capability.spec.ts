import { ServiceUnavailableException } from '@nestjs/common';

// The service module's import graph is why no service spec existed before this one: @gauzy/core pulls
// the whole bootstrap (config, database, an ESM package jest cannot parse), and the tool builders pull
// the ESM-only `ai` SDK. None of that is on the code paths under test, so it is stubbed AT THE MODULE
// BOUNDARY — hoisted above the imports — leaving the real service, registry and capability logic live.
jest.mock('@gauzy/core', () => ({ RequestContext: class {} }));
jest.mock('./esm-loader', () => ({ loadAiSdk: jest.fn() }));
jest.mock('./tools/gauzy-api-client', () => ({ GauzyApiClient: class {} }));
jest.mock('./tools/gauzy-tools', () => ({ buildGauzyTools: jest.fn(), GAUZY_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/client-tools', () => ({ buildClientTools: jest.fn(), CLIENT_TOOLS_REQUIRING_APPROVAL: [] }));
jest.mock('./tools/mcp-tools', () => ({ createMcpTools: jest.fn() }));
jest.mock('./credentials/ai-provider-credential.service', () => ({ AiProviderCredentialService: class {} }));
jest.mock('./conversations/ai-chat-conversation.service', () => ({ AiChatConversationService: class {} }));

import { AiProviderRegistry } from './provider-registry';
import { AiChatService } from './ai-chat.service';
import { IAiChatProviderDefinition } from './provider.types';

/**
 * The `chatCapable` contract, pinned from the backend side — the side that emits it.
 *
 * A placeholder provider (its `createModel` still throws) is registered so it SHOWS in the UI, and
 * everything else about it is opt-out: it must never be defaulted to, never be selectable, and —
 * covered here because it was the gap review found — never reachable by NAMING it explicitly, which
 * any client can do the moment `/config` advertises the id. Without the boundary check the request
 * sailed through to `createModel()` and surfaced the provider's raw not-implemented error as a
 * failed turn.
 *
 * The serialization rule matters as much as the gate: the UI treats ABSENT as capable and exactly
 * `false` as placeholder, so a change that starts emitting `true` (or dropping the field for
 * placeholders) silently flips the settings guidance. Both directions are asserted.
 */
describe('AiChatService chatCapable boundary', () => {
	const placeholder: IAiChatProviderDefinition = {
		id: 'test-placeholder',
		label: 'Test Placeholder',
		apiKeyEnvVars: [],
		models: [],
		defaultModel: '',
		chatCapable: false,
		async createModel(): Promise<never> {
			throw new Error('raw not-implemented error that must never reach a user');
		}
	};

	const capable: IAiChatProviderDefinition = {
		id: 'test-capable',
		label: 'Test Capable',
		apiKeyEnvVars: ['TEST_CAPABLE_API_KEY'],
		models: [{ id: 'test-model', label: 'Test Model', providerId: 'test-capable' }],
		defaultModel: 'test-model',
		async createModel() {
			return {} as never;
		}
	};

	/** Service with the DB-touching privates stubbed — the capability logic is what's under test. */
	const service = (): AiChatService => {
		const instance = new AiChatService(null as never, null as never);
		(instance as unknown as { getTenantCredential: unknown }).getTenantCredential = async () => ({
			// A SAVED tenant key for every provider, placeholder included: the boundary must hold
			// even when credentials resolve, because tenant BYOK is resolved first and emptying the
			// placeholder's env vars cannot close that route.
			apiKey: 'tenant-key',
			enabled: true
		});
		(instance as unknown as { resolveDefaultProvider: unknown }).resolveDefaultProvider = async () => ({});
		return instance;
	};

	beforeEach(() => {
		AiProviderRegistry.clear();
		AiProviderRegistry.register(placeholder);
		AiProviderRegistry.register(capable);
	});

	afterAll(() => {
		AiProviderRegistry.clear();
	});

	it('rejects an EXPLICIT request for a placeholder with a controlled 503, not the raw provider error', async () => {
		const resolve = (service() as unknown as { resolveModel(p?: string, m?: string): Promise<unknown> }).resolveModel(
			'test-placeholder'
		);

		await expect(resolve).rejects.toBeInstanceOf(ServiceUnavailableException);
		await expect(resolve).rejects.toThrow(/cannot serve chat yet/);
		await expect(resolve).rejects.not.toThrow(/raw not-implemented/);
	});

	it('emits chatCapable exactly false for a placeholder and OMITS it for a capable provider', async () => {
		const config = await service().getConfig();
		const byId = new Map(config.providers.map((provider) => [provider.id, provider]));

		expect(byId.get('test-placeholder')?.chatCapable).toBe(false);
		// Omitted, not true: absent-means-capable is the wire contract the settings UI branches on.
		expect('chatCapable' in (byId.get('test-capable') ?? {})).toBe(false);
	});

	it('keeps a placeholder with a saved credential out of the configured set', async () => {
		const config = await service().getConfig();
		const byId = new Map(config.providers.map((provider) => [provider.id, provider]));

		expect(byId.get('test-placeholder')?.configured).toBe(false);
		expect(byId.get('test-capable')?.configured).toBe(true);
	});
});
