import * as chalk from 'chalk';
import { IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from './provider-registry';
import { IAiChatProviderDefinition } from './provider.types';

/**
 * BaseAiProviderPlugin
 *
 * Shared lifecycle for `@gauzy/plugin-ai-provider-*` plugins: registers the
 * plugin's {@link IAiChatProviderDefinition} with the {@link AiProviderRegistry}
 * on bootstrap and removes it on destroy.
 *
 * A provider plugin only needs to supply its definition:
 *
 * ```ts
 * @Plugin({})
 * export class AiProviderAcmePlugin extends BaseAiProviderPlugin {
 * 	protected readonly definition = acmeProviderDefinition;
 * }
 * ```
 */
export abstract class BaseAiProviderPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	/** The provider definition this plugin contributes. */
	protected abstract readonly definition: IAiChatProviderDefinition;

	// We disable by default additional logging for each event to avoid cluttering the logs
	protected logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(this.definition);

		if (this.logEnabled) {
			console.log(chalk.green(`${this.constructor.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(this.definition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${this.constructor.name} is being destroyed...`));
		}
	}
}
