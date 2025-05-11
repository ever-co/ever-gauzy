import { Injectable } from '@angular/core';
import { PostHogService } from './posthog.service';
import { PostHogModuleConfig } from '../interfaces/posthog.interface';
import { PostHog, PostHogConfig, Properties } from 'posthog-js';
import { Router } from '@angular/router';

/**
 * Service manager that provides a high-level API for application components
 * This should be the primary service used by application code
 */
@Injectable({
	providedIn: 'root'
})
export class PostHogServiceManager {
	constructor(private posthogService: PostHogService, private router: Router) {}

	/**
	 * Initialize PostHog with the provided configuration
	 * Returns true if initialization was successful
	 */
	initialize(config: PostHogModuleConfig): boolean {
		if (this.posthogService.isInitialized()) {
			console.warn('PostHogServiceManager already initialized');
			return false;
		}

		if (!config?.apiKey) {
			console.warn('No PostHog API key provided');
			return false;
		}

		const { apiKey, options = {} } = config;

		// Initialize the base service
		const initialized = this.posthogService.initialize(apiKey, options);

		if (initialized) {
			// Setup route tracking
			this.posthogService.setupRouteTracking(this.router);

			// Configure additional behaviors based on options
			this.setupConfigBasedBehaviors(options);
		}

		return initialized;
	}

	/**
	 * Configure PostHog behaviors based on the options provided
	 */
	private setupConfigBasedBehaviors(options: Partial<PostHogConfig>): void {
		// Feature flags configuration
		if (options.advanced_disable_feature_flags !== true) {
			// If feature flags aren't disabled, ensure they're loaded
			if (options.advanced_disable_feature_flags_on_first_load !== true) {
				this.reloadFeatureFlags();
			}
		}

		// Session recording configuration
		if (options.disable_session_recording !== true) {
			// If session recording is enabled, start it
			this.startSessionRecording();
		}

		// Handle person properties initialization if provided in bootstrap
		if (options.bootstrap?.distinctID) {
			this.identifyUser(options.bootstrap.distinctID);
		}

		// Set up super properties if needed
		const superProps: Record<string, any> = {};

		// Add application info if using persistent storage
		if (options.persistence !== 'memory') {
			// Using a persistent method, set up any default properties
			superProps['app_version'] = this.getAppVersion();
			this.posthogService.getInstance().register(superProps);
		}
	}

	/**
	 * Track a custom event with the appropriate properties
	 */
	trackEvent(eventName: string, properties: Properties = {}): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.captureEvent(eventName, properties);
	}

	/**
	 * Track a page view, respecting the configuration settings
	 */
	trackPageView(url?: string, properties: Properties = {}): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.capturePageview(url, properties);
	}

	/**
	 * Identify a user with the given ID and properties
	 */
	identifyUser(userId: string, properties: Properties = {}): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().identify(userId, properties);
	}

	/**
	 * Check if a feature flag is enabled
	 * @param flagKey The feature flag key
	 * @param options Optional settings for the flag check
	 * @returns boolean indicating if the flag is enabled
	 */
	isFeatureEnabled(flagKey: string, options?: { send_event: boolean }): boolean {
		if (!this.posthogService.isInitialized()) return false;

		// Get the feature flag value
		const flagValue = this.posthogService.getInstance().isFeatureEnabled(flagKey, options);

		// isFeatureEnabled already returns a boolean
		return flagValue === true;
	}

	/**
	 * Get a feature flag value with proper typing
	 * @param flagKey The feature flag key
	 * @param defaultValue Default value to return if flag is not found
	 * @returns The flag value or defaultValue if not found
	 */
	getFeatureFlagValue<T>(flagKey: string, defaultValue: T): T {
		if (!this.posthogService.isInitialized()) return defaultValue;

		// Get the feature flag value with default fallback
		const flagValue = this.posthogService.getInstance().getFeatureFlag(flagKey) as T;

		// Return the flag value or default if undefined
		return flagValue !== undefined ? flagValue : defaultValue;
	}

	/**
	 * Reload feature flags from the server
	 */
	reloadFeatureFlags(): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().reloadFeatureFlags();
	}

	/**
	 * Set person properties for the current user
	 */
	setUserProperties(properties: Properties): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().people.set(properties);
	}

	/**
	 * Opt user in to tracking
	 */
	optInTracking(): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().opt_in_capturing();
	}

	/**
	 * Opt user out of tracking
	 */
	optOutTracking(): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().opt_out_capturing();
	}

	/**
	 * Reset the current user
	 */
	resetUser(): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().reset();
	}

	/**
	 * Associate the current user with a group
	 */
	setGroup(groupType: string, groupKey: string, groupProperties: Properties = {}): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().group(groupType, groupKey, groupProperties);
	}

	/**
	 * Track an error with the appropriate context
	 */
	trackError(error: Error, properties: Properties = {}): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.captureError(error, properties);
	}

	/**
	 * Get the application version
	 */
	private getAppVersion(): string {
		return '1.0.0'; // Replace with actual version logic
	}

	/**
	 * Start session recording
	 */
	startSessionRecording(): void {
		if (!this.posthogService.isInitialized()) return;
		this.posthogService.getInstance().startSessionRecording();
	}

	/**
	 * Get the raw PostHog instance for advanced usage
	 */
	getPostHogInstance(): PostHog {
		return this.posthogService.getInstance();
	}
}
