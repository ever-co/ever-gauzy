import { DynamicModule } from '@nestjs/common';
import { CorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { JitsuAnalyticsService } from './jitsu-analytics.service';
import { JITSU_MODULE_PROVIDER_CONFIG, JitsuModuleOptions } from './jitsu.types';
import { JitsuEventsSubscriber } from './jitsu-events-subscriber';

@CorePlugin({
	providers: [
		JitsuAnalyticsService
	],
	subscribers: [
		JitsuEventsSubscriber
	]
})
export class JitsuAnalyticsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('JitsuAnalyticsPlugin is being bootstrapped...');
			// Your existing logic here...
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('JitsuAnalyticsPlugin is being destroyed...');
			// Your existing logic here...
		}
	}

	/**
	 * Create a dynamic module for configuring and initializing the Jitsu Analytics module.
	 * @param options The options for configuring the Jitsu Analytics module.
	 * @returns A dynamic module definition.
	 */
	static init(options: JitsuModuleOptions): DynamicModule {
		return {
			global: options.isGlobal || true,
			module: JitsuAnalyticsPlugin,
			providers: [
				{
					provide: JITSU_MODULE_PROVIDER_CONFIG,
					useFactory: () => options.config,
				},
				JitsuAnalyticsService
			],
			exports: [
				JitsuAnalyticsService
			],
		};
	}
}
