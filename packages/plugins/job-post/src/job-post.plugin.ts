
import { GauzyCorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';

@GauzyCorePlugin({
	imports: [],
	entities: [],
	providers: []
})
export class JobPostPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobPostPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobPostPlugin.name} is being destroyed...`);
		}
	}
}
