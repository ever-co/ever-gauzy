import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';

@Plugin({
	imports: [],
	configuration: (config: ApplicationPluginConfig) => {
		return config;
	}
})
export class IntegrationGithubPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${IntegrationGithubPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${IntegrationGithubPlugin.name} is being destroyed...`);
		}
	}
}
