import { NgModule, ModuleWithProviders, InjectionToken } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { PostHogTrackDirective } from './directives/posthog-track.directive';
import { PostHogInterceptor } from './interceptors/posthog.interceptor';
import { PostHogService } from './services/posthog.service';
import { PostHogConfig } from 'posthog-js';

/**
 * Injection token for providing PostHog configuration
 */
export const POSTHOG_CONFIG = new InjectionToken<PostHogConfig>('POSTHOG_CONFIG');

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
	static forRoot(config: PostHogConfig): ModuleWithProviders<PostHogModule> {
		return {
			ngModule: PostHogModule,
			providers: [
				PostHogService,
				{
					provide: POSTHOG_CONFIG,
					useValue: config
				},
				// Optionally add HTTP interceptor if capture_exceptions is enabled
				...(config.capture_exceptions
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
