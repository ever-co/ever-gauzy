import { NgModule, ModuleWithProviders, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { PostHogTrackDirective } from './directives/posthog-track.directive';
import { PostHogInterceptor } from './interceptors/posthog.interceptor';
import { PostHogService } from './services/posthog.service';
import { POSTHOG_CONFIG, PostHogModuleConfig, POSTHOG_DEBUG_MODE } from './interfaces/posthog.interface';
import { initializePostHogFactory } from './services/posthog-init.factory';
import { PostHogServiceManager } from './services/posthog-manager.service';
import { PostHogFormTrackDirective } from './directives/posthog-form-track.directive';

/**
 * Module for integrating PostHog into Angular applications
 */
@NgModule({
	imports: [CommonModule, PostHogTrackDirective, PostHogFormTrackDirective],
	exports: [PostHogTrackDirective, PostHogFormTrackDirective]
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
				// Core services
				PostHogService,
				PostHogServiceManager,
				{
					provide: POSTHOG_CONFIG,
					useValue: config
				},
				{
					provide: POSTHOG_DEBUG_MODE,
					useValue: config.debug || false
				},
				// Initialize PostHog during app startup
				{
					provide: APP_INITIALIZER,
					useFactory: initializePostHogFactory,
					deps: [PostHogServiceManager, POSTHOG_CONFIG],
					multi: true
				},
				// Conditionally add HTTP interceptor for error tracking
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

	/**
	 * Provides PostHog for testing/mocking purposes without initialization
	 */
	static forTesting(): ModuleWithProviders<PostHogModule> {
		return {
			ngModule: PostHogModule,
			providers: [
				PostHogService,
				PostHogServiceManager,
				{
					provide: POSTHOG_CONFIG,
					useValue: { apiKey: 'test-key', options: { loaded: () => {} } }
				},
				{
					provide: POSTHOG_DEBUG_MODE,
					useValue: true
				}
			]
		};
	}
}
