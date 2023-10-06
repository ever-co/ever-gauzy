import { DynamicModule, Module } from '@nestjs/common';
import { JitsuAnalyticsService } from './jitsu-analytics.service';
import { JITSU_MODULE_PROVIDER_CONFIG, JitsuModuleOptions } from './jitsu.types';

@Module({
	providers: [
		JitsuAnalyticsService
	],
})
export class JitsuAnalyticsModule {
	/**
	 * Create a dynamic module for configuring and initializing the Jitsu Analytics module.
	 * @param options The options for configuring the Jitsu Analytics module.
	 * @returns A dynamic module definition.
	 */
	static forRoot(options: JitsuModuleOptions): DynamicModule {
		return {
			global: options.isGlobal || true,
			module: JitsuAnalyticsModule,
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
