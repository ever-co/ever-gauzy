import { NgModule, ModuleWithProviders, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { PostHogTrackDirective } from './directives/posthog-track.directive';
import { PostHogInterceptor } from './interceptors/posthog.interceptor';
import { PostHogService } from './services/posthog.service';
import { POSTHOG_CONFIG, PostHogModuleConfig } from './interfaces/posthog.interface';
import { initializePostHogFactory } from './services/posthog-init.factory';
import { PostHogServiceManager } from './services/posthog-manager.service';

/**
 * Module for integrating PostHog into Angular applications
 */
@NgModule({
	declarations: [PostHogTrackDirective],
	imports: [CommonModule],
	exports: [PostHogTrackDirective]
})
export class PostHogModule {
	/**
	 * Configures and provides the PostHog module with initialization options
	 * @param config - Configuration options including API key
	 * @returns Module with providers configured
	 */
	static forRoot(config: PostHogModuleConfig): ModuleWithProviders<PostHogModule> {
		return {
			ngModule: PostHogModule,
			providers: [
				PostHogService,
				PostHogServiceManager,
				{
					provide: POSTHOG_CONFIG,
					useValue: config
				},
				{
					provide: APP_INITIALIZER,
					useFactory: initializePostHogFactory,
					deps: [PostHogServiceManager],
					multi: true
				},

				...(config.options?.capture_exceptions !== false
					? [
							{
								provide: HTTP_INTERCEPTORS,
								useClass: PostHogInterceptor,
								multi: true
							}
					  ]
					: [])
			]
		};
	}
}
