import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiProviderRegistry } from '@gauzy/plugin-ai-chat';
import { vercelGatewayProviderDefinition } from './ai-provider-vercel-gateway.provider';

/**
 * AiProviderVercelGatewayPlugin
 *
 * Contributes the Vercel AI Gateway provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link vercelGatewayProviderDefinition}
 * with the {@link AiProviderRegistry} on bootstrap.
 */
@Plugin({})
export class AiProviderVercelGatewayPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 * Registers the Vercel AI Gateway provider definition with the AI provider registry.
	 */
	onPluginBootstrap(): void | Promise<void> {
		AiProviderRegistry.register(vercelGatewayProviderDefinition);

		if (this.logEnabled) {
			console.log(chalk.green(`${AiProviderVercelGatewayPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 * Removes the Vercel AI Gateway provider definition from the AI provider registry.
	 */
	onPluginDestroy(): void | Promise<void> {
		AiProviderRegistry.unregister(vercelGatewayProviderDefinition.id);

		if (this.logEnabled) {
			console.log(chalk.red(`${AiProviderVercelGatewayPlugin.name} is being destroyed...`));
		}
	}
}
