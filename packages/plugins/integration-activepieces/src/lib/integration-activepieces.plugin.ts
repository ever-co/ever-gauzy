import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ActivepiecesModule } from './activepieces.module';

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [ActivepiecesModule],
	/**
	 * A callback that receives the main plugin configuration object and allows
	 * custom modifications before returning the final configuration.
	 *
	 * @param {ApplicationPluginConfig} config - The initial plugin configuration object.
	 * @returns {ApplicationPluginConfig} - The modified plugin configuration object.
	 */
	configuration: (config: ApplicationPluginConfig) => {
		return config;
	}
})
export class IntegrationActivepiecesPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('IntegrationActivepiecesPlugin is being bootstrapped...');
		}
	}
	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('IntegrationActivepiecesPlugin is being destroyed...');
		}
	}
}
