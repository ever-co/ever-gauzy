import { Injectable, Inject, Optional } from '@angular/core';
import { PostHogService } from './posthog.service';
import { POSTHOG_CONFIG, PostHogModuleConfig } from '../interfaces/posthog.interface';
import { PostHog, PostHogConfig } from 'posthog-js';

/**
 * Service manager that initializes and calls appropriate PostHog methods
 * based on the provided configuration options
 */
@Injectable({
	providedIn: 'root'
})
export class PostHogServiceManager {
	private initialized = false;

	constructor(
		private posthogService: PostHogService,
		@Optional()
		@Inject(POSTHOG_CONFIG)
		private injectedConfig: PostHogModuleConfig
	) {
		// Auto-initialize if config was injected
		if (this.injectedConfig?.apiKey) {
			this.initialize(this.injectedConfig);
		}
	}

	/**
	 * Initialize PostHog with the provided configuration and set up
	 * appropriate behaviors based on config options
	 */
	initialize(config: PostHogModuleConfig): void {
		if (this.initialized) {
			console.warn('PostHogServiceManager already initialized');
			return;
		}

		const { apiKey, options = {} } = config;

		// Initialize the base service
		this.posthogService.initialize(apiKey, options);

		this.setupConfigBasedBehaviors(options);

		this.initialized = true;
	}

	/**
	 * Configure PostHog behaviors based on the options provided
	 */
	private setupConfigBasedBehaviors(options: Partial<PostHogConfig>): void {
		// Feature flags configuration
		if (options.advanced_disable_feature_flags !== true) {
			// If feature flags aren't disabled, ensure they're loaded (unless disabled on first load)
			if (options.advanced_disable_feature_flags_on_first_load !== true) {
				this.posthogService.reloadFeatureFlags();
			}
		}

		// Session recording configuration
		if (options.disable_session_recording !== true) {
			// If session recording is enabled, start it
			this.posthogService.startSessionRecording();
		}

		// If user opt-in is required, respect this setting
		if (options.opt_out_capturing_by_default === true) {
			// Don't automatically track until user opts in
			console.info('PostHog tracking requires user opt-in. Call optIn() when user consents.');
		}

		// Handle person properties initialization if provided in bootstrap
		if (options.bootstrap?.distinctID) {
			this.posthogService.identify(options.bootstrap.distinctID);
		}

		// Set up super properties if any default ones are needed
		const superProps: Record<string, any> = {};

		// Add application info if needed
		if (options.persistence !== 'memory') {
			// Using a persistent method, set up any default properties
			superProps['app_version'] = this.getAppVersion();

			this.posthogService.register(superProps);
		}
	}

	/**
	 * Track a custom event with the appropriate properties
	 */
	trackEvent(eventName: string, properties: Record<string, any> = {}): void {
		this.ensureInitialized();
		this.posthogService.captureEvent(eventName, properties);
	}

	/**
	 * Track a page view, respecting the configuration settings
	 */
	trackPageView(url?: string, properties: Record<string, any> = {}): void {
		this.ensureInitialized();
		this.posthogService.capturePageview(url, properties);
	}

	/**
	 * Identify a user with the given ID and properties
	 */
	identifyUser(userId: string, properties: Record<string, any> = {}): void {
		this.ensureInitialized();
		this.posthogService.identify(userId, properties);
	}

	/**
	 * Check if a feature flag is enabled
	 */
	isFeatureEnabled(flagKey: string): boolean {
		this.ensureInitialized();

		// Get the feature flag value (default to false if not found)
		const flagValue = this.posthogService.getFeatureFlag(flagKey, false);

		// Return boolean result
		return Boolean(flagValue === true || flagValue === 'true');
	}

	/**
	 * Get a feature flag value with proper typing
	 */
	getFeatureFlagValue<T>(flagKey: string, defaultValue: T): T {
		this.ensureInitialized();
		return this.posthogService.getFeatureFlag(flagKey, defaultValue);
	}

	/**
	 * Reload feature flags from the server
	 */
	reloadFeatureFlags(): void {
		this.ensureInitialized();
		this.posthogService.reloadFeatureFlags();
	}

	/**
	 * Set person properties for the current user
	 */
	setUserProperties(properties: Record<string, any>): void {
		this.ensureInitialized();
		this.posthogService.setPersonProperties(properties);
	}

	/**
	 * Opt user in to tracking
	 */
	optInTracking(): void {
		this.ensureInitialized();
		this.posthogService.optIn();
	}

	/**
	 * Opt user out of tracking
	 */
	optOutTracking(): void {
		this.ensureInitialized();
		this.posthogService.optOut();
	}

	/**
	 * Reset the current user
	 */
	resetUser(): void {
		this.ensureInitialized();
		this.posthogService.reset();
	}

	/**
	 * Associate the current user with a group
	 */
	setGroup(groupType: string, groupKey: string, groupProperties: Record<string, any> = {}): void {
		this.ensureInitialized();
		this.posthogService.group(groupType, groupKey, groupProperties);
	}

	/**
	 * Track an error with the appropriate context
	 */
	trackError(error: Error, properties: Record<string, any> = {}): void {
		this.ensureInitialized();
		this.posthogService.captureError(error, properties);
	}

	/**
	 * Get the application version
	 */
	private getAppVersion(): string {
		return '1.0.0'; // Replace with actual version logic
	}

	/**
	 * Ensure the service is initialized before use
	 */
	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('PostHogServiceManager not initialized. Call initialize() first.');
		}
	}

	/**
	 * Get the raw PostHog instance for advanced usage
	 */
	getPostHogInstance(): PostHog {
		this.ensureInitialized();
		return this.posthogService.getInstance();
	}
}
