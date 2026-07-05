import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from '@gauzy/plugin-ai-chat';
import { anthropicProviderDefinition } from './ai-provider-anthropic.provider';

/**
 * AiProviderAnthropicPlugin
 *
 * Contributes the Anthropic (Claude) provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link anthropicProviderDefinition}
 * with the {@link AiProviderRegistry} on bootstrap.
 */
@Plugin({})
export class AiProviderAnthropicPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the Anthropic provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(anthropicProviderDefinition);

		if (this.logEnabled) {
			console.log(chalk.green(`${AiProviderAnthropicPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the Anthropic provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(anthropicProviderDefinition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${AiProviderAnthropicPlugin.name} is being destroyed...`));
		}
	}
}
