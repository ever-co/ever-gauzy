import { IOnPluginBootstrap, IOnPluginDestroy, GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import * as chalk from 'chalk';
import { entities } from './domain/entities';
import { PluginRegistryModule } from './plugin-registry.module';

@Plugin({
	imports: [PluginRegistryModule],
	entities
})
export class RegistryPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${RegistryPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${RegistryPlugin.name} is being destroyed...`));
		}
	}
}
