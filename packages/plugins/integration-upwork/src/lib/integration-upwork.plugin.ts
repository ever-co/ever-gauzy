import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { UpworkModule } from './upwork.module';

@Plugin({
	imports: [UpworkModule],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationUpworkPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() {}

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${IntegrationUpworkPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${IntegrationUpworkPlugin.name} is being destroyed...`);
		}
	}
}
