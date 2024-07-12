import { DynamicModule } from '@nestjs/common';
import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { JITSU_MODULE_PROVIDER_CONFIG, JitsuModuleOptions } from './jitsu.types';
import { parseOptions } from './jitsu-helper';
import { JitsuAnalyticsService } from './jitsu-analytics.service';
import { JitsuEventsSubscriber } from './jitsu-events.subscriber';

@Plugin({
	providers: [
		JitsuAnalyticsService,
		{
			provide: JITSU_MODULE_PROVIDER_CONFIG,
			useFactory: () => JitsuAnalyticsPlugin.options?.config
		}
	],
	subscribers: [JitsuEventsSubscriber]
})
export class JitsuAnalyticsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	static options: JitsuModuleOptions = {} as any;

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${JitsuAnalyticsPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${JitsuAnalyticsPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Create a dynamic module for configuring and initializing the Jitsu Analytics module.
	 * @param options The options for configuring the Jitsu Analytics module.
	 * @returns A dynamic module definition.
	 */
	static init(options: JitsuModuleOptions): DynamicModule {
		// Assuming `parseOptions` is defined
		this.options = parseOptions(options);

		return {
			global: options.isGlobal ?? true,
			module: JitsuAnalyticsPlugin,
			providers: [
				JitsuAnalyticsService,
				{
					provide: JITSU_MODULE_PROVIDER_CONFIG,
					useFactory: () => options.config
				}
			],
			exports: [JitsuAnalyticsService]
		};
	}
}
