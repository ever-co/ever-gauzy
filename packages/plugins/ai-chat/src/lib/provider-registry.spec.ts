import { Logger } from '@nestjs/common';
import { AiProviderRegistry } from './provider-registry';
import { IAiChatProviderDefinition } from './provider.types';

/**
 * Builds a minimal provider definition for registry tests.
 */
const createDefinition = (overrides: Partial<IAiChatProviderDefinition> = {}): IAiChatProviderDefinition => ({
	id: 'test-provider',
	label: 'Test Provider',
	apiKeyEnvVars: ['TEST_PROVIDER_API_KEY'],
	models: [],
	defaultModel: 'test-model',
	createModel: jest.fn().mockResolvedValue({} as any),
	...overrides
});

describe('AiProviderRegistry', () => {
	let warnSpy: jest.SpyInstance;
	let logSpy: jest.SpyInstance;

	beforeEach(() => {
		// Keep test output clean and make the replace-warning observable.
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		AiProviderRegistry.clear();
	});

	afterEach(() => {
		AiProviderRegistry.clear();
		jest.restoreAllMocks();
	});

	describe('register / get', () => {
		it('should register a provider and retrieve it by id', () => {
			const definition = createDefinition();
			AiProviderRegistry.register(definition);
			expect(AiProviderRegistry.get('test-provider')).toBe(definition);
		});

		it('should log the registration', () => {
			AiProviderRegistry.register(createDefinition());
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-provider'));
		});

		it('should return undefined for an unknown provider id', () => {
			expect(AiProviderRegistry.get('does-not-exist')).toBeUndefined();
		});

		it('should not warn when registering a new (non-duplicate) provider', () => {
			AiProviderRegistry.register(createDefinition({ id: 'provider-a' }));
			AiProviderRegistry.register(createDefinition({ id: 'provider-b' }));
			expect(warnSpy).not.toHaveBeenCalled();
		});
	});

	describe('replace behavior', () => {
		it('should warn and replace when registering an already-registered id', () => {
			const original = createDefinition({ label: 'Original' });
			const replacement = createDefinition({ label: 'Replacement' });

			AiProviderRegistry.register(original);
			AiProviderRegistry.register(replacement);

			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'test-provider'"));
			expect(AiProviderRegistry.get('test-provider')).toBe(replacement);
			// The replaced definition must not linger as a duplicate entry.
			expect(AiProviderRegistry.list()).toHaveLength(1);
		});
	});

	describe('list', () => {
		it('should return an empty array when nothing is registered', () => {
			expect(AiProviderRegistry.list()).toEqual([]);
		});

		it('should list all registered providers', () => {
			const a = createDefinition({ id: 'provider-a', label: 'Provider A' });
			const b = createDefinition({ id: 'provider-b', label: 'Provider B' });
			AiProviderRegistry.register(a);
			AiProviderRegistry.register(b);

			const listed = AiProviderRegistry.list();
			expect(listed).toHaveLength(2);
			expect(listed).toEqual(expect.arrayContaining([a, b]));
		});

		it('should return a snapshot array that does not mutate the registry', () => {
			AiProviderRegistry.register(createDefinition({ id: 'provider-a' }));
			const listed = AiProviderRegistry.list();
			listed.pop();
			expect(AiProviderRegistry.list()).toHaveLength(1);
		});
	});

	describe('unregister', () => {
		it('should remove a registered provider', () => {
			AiProviderRegistry.register(createDefinition());
			AiProviderRegistry.unregister('test-provider');
			expect(AiProviderRegistry.get('test-provider')).toBeUndefined();
			expect(AiProviderRegistry.list()).toHaveLength(0);
		});

		it('should be a no-op for an unknown id', () => {
			AiProviderRegistry.register(createDefinition());
			expect(() => AiProviderRegistry.unregister('does-not-exist')).not.toThrow();
			expect(AiProviderRegistry.list()).toHaveLength(1);
		});
	});

	describe('clear', () => {
		it('should remove all registered providers', () => {
			AiProviderRegistry.register(createDefinition({ id: 'provider-a' }));
			AiProviderRegistry.register(createDefinition({ id: 'provider-b' }));
			AiProviderRegistry.clear();
			expect(AiProviderRegistry.list()).toEqual([]);
			expect(AiProviderRegistry.get('provider-a')).toBeUndefined();
		});
	});
});
