import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from '@gauzy/plugin-ai-chat';
import { gauzyAiProviderDefinition } from './ai-provider-gauzy-ai.provider';

/**
 * AiProviderGauzyAiPlugin
 *
 * Contributes the Gauzy AI provider placeholder to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link gauzyAiProviderDefinition}
 * with the {@link AiProviderRegistry} on bootstrap. Chat is not yet routed
 * through Gauzy AI — see the plugin README for the planned design.
 */
@Plugin({})
export class AiProviderGauzyAiPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the Gauzy AI provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(gauzyAiProviderDefinition);

		if (this.logEnabled) {
			console.log(chalk.green(`${AiProviderGauzyAiPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the Gauzy AI provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(gauzyAiProviderDefinition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${AiProviderGauzyAiPlugin.name} is being destroyed...`));
		}
	}
}
