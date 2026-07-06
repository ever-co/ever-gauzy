import { Logger } from '@nestjs/common';
import { IAiChatProviderDefinition } from './provider.types';

/**
 * AiProviderRegistry
 *
 * Process-wide registry of AI providers. Provider plugins
 * (`@gauzy/plugin-ai-provider-*`) call {@link AiProviderRegistry.register}
 * from their `onPluginBootstrap`; the chat engine reads the registry at
 * request time.
 *
 * Implemented as a static registry (not Nest DI) so provider plugins do not
 * need to import the chat module's Nest graph — mirroring how backend
 * plugins are composed via the flat `plugins.ts` list.
 */
export class AiProviderRegistry {
	private static readonly logger = new Logger('AiProviderRegistry');
	private static readonly providers = new Map<string, IAiChatProviderDefinition>();

	/** Register (or replace) a provider definition. */
	static register(definition: IAiChatProviderDefinition): void {
		if (this.providers.has(definition.id)) {
			this.logger.warn(`AI provider '${definition.id}' was already registered — replacing.`);
		}
		this.providers.set(definition.id, definition);
		this.logger.log(`AI provider registered: ${definition.id} (${definition.label})`);
	}

	/** Remove a provider (plugin teardown). */
	static unregister(id: string): void {
		this.providers.delete(id);
	}

	static get(id: string): IAiChatProviderDefinition | undefined {
		return this.providers.get(id);
	}

	static list(): IAiChatProviderDefinition[] {
		return [...this.providers.values()];
	}

	static clear(): void {
		this.providers.clear();
	}
}
