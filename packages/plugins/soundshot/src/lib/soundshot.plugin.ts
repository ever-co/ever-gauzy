import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { SoundshotModule } from './soundshot.module';
import { Soundshot } from './entity/soundshot.entity';


@Plugin({
	imports: [SoundshotModule],
	entities: [Soundshot],
})
export class SoundshotPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We enable by default additional logging for each event
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${SoundshotPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${SoundshotPlugin.name} is being destroyed...`));
		}
	}
}
