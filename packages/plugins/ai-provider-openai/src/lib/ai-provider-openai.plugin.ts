import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from '@gauzy/plugin-ai-chat';
import { openAiProviderDefinition } from './ai-provider-openai.provider';

/**
 * AiProviderOpenAiPlugin
 *
 * Contributes the OpenAI (GPT) provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link openAiProviderDefinition}
 * with the {@link AiProviderRegistry} on bootstrap.
 */
@Plugin({})
export class AiProviderOpenAiPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the OpenAI provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(openAiProviderDefinition);

		if (this.logEnabled) {
			console.log(chalk.green(`${AiProviderOpenAiPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the OpenAI provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(openAiProviderDefinition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${AiProviderOpenAiPlugin.name} is being destroyed...`));
		}
	}
}
