import * as chalk from 'chalk';
import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { MakeComModule } from './make-com.module';

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [MakeComModule],
	/**
	 * No entities needed for Make.com integration since we're using existing
	 * IntegrationSetting entity
	 */
	entities: [],
	/**
	 * A callback that receives the main plugin configuration object and allows
	 * custom modifications before returning the final configuration.
	 *
	 * @param {ApplicationPluginConfig} config - The initial plugin configuration object.
	 * @returns {ApplicationPluginConfig} - The modified plugin configuration object.
	 */
	configuration: (config: ApplicationPluginConfig) => {
		// No custom fields needed for now
		return config;
	}
})
export class IntegrationMakeComPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationMakeComPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationMakeComPlugin.name} is being destroyed...`));
		}
	}
}
