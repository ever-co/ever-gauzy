import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CamshotModule } from './camshot.module';
import { Camshot } from './entity/camshot.entity';


@Plugin({
	imports: [CamshotModule],
	entities: [Camshot],
})
export class CamshotPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We enable by default additional logging for each event
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${CamshotPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${CamshotPlugin.name} is being destroyed...`));
		}
	}
}
