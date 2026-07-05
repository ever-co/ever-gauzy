import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from '@gauzy/plugin-ai-chat';
import { openRouterProviderDefinition } from './ai-provider-openrouter.provider';

/**
 * AiProviderOpenRouterPlugin
 *
 * Contributes the OpenRouter provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link openRouterProviderDefinition}
 * with the {@link AiProviderRegistry} on bootstrap.
 */
@Plugin({})
export class AiProviderOpenRouterPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the OpenRouter provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(openRouterProviderDefinition);

		if (this.logEnabled) {
			console.log(chalk.green(`${AiProviderOpenRouterPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the OpenRouter provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(openRouterProviderDefinition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${AiProviderOpenRouterPlugin.name} is being destroyed...`));
		}
	}
}
