import { Injectable, Inject, Optional, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import posthog, { PostHog, PostHogConfig, Properties } from 'posthog-js';
import { POSTHOG_CONFIG, PostHogModuleConfig } from '../interfaces/posthog.interface';

/**
 * Complete PostHog service for Angular applications
 * Provides integration with all PostHog features including:
 * - Event tracking
 * - User identification
 * - Feature flags
 * - Session recording
 * - Heatmaps
 * - Group analytics
 * - Funnel analysis
 * - Error monitoring
 */
@Injectable({
	providedIn: 'root'
})
export class PostHogService {
	private initialized = false;
	private config: any = {};

	constructor(
		private router: Router,
		@Inject(PLATFORM_ID) private platformId: Object,
		@Optional()
		@Inject(POSTHOG_CONFIG)
		private injectedConfig: PostHogModuleConfig
	) {
		// Auto-initialize if config was provided via DI
		if (this.injectedConfig?.apiKey) {
			this.initialize(this.injectedConfig.apiKey, this.injectedConfig.options || {});
		} else {
			console.warn('No PostHog config found!');
		}
	}

	/**
	 * Initializes PostHog with API key and configuration options
	 * @param apiKey - Your PostHog API key
	 * @param config - Configuration options for PostHog
	 */
	initialize(apiKey: string, config: any = {}): void {
		// Only initialize in browser environment to prevent SSR issues
		if (isPlatformBrowser(this.platformId) && !this.initialized) {
			this.config = {
				api_host: config.api_host || 'https://app.posthog.com',
				capture_pageview: false, // We'll handle pageviews manually for more control
				loaded: (ph: PostHog) => {
					// Once loaded, we can set up automatic route tracking
					this.setupRouteTracking();

					// Call the user's loaded callback if provided
					if (config.loaded) {
						config.loaded(ph);
					}
				},
				...config
			};

			// Initialize PostHog with API key and configuration
			posthog.init(apiKey, this.config);

			// Attach error tracking if not explicitly disabled
			if (config.capture_exceptions !== false) {
				this.setupErrorTracking();
			}

			this.initialized = true;
		}
	}

	/**
	 * Sets up automatic tracking of page views when navigation completes
	 * Includes route information and timing metrics
	 */
	private setupRouteTracking(): void {
		if (!isPlatformBrowser(this.platformId)) return;

		let routeStartTime: number | null = null;

		// Set start time at the beginning of navigation
		this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event: NavigationEnd) => {
			const navigationEndTime = Date.now();
			const loadTime = routeStartTime ? navigationEndTime - routeStartTime : 0;

			// Capture detailed page view with route information
			this.capturePageview(event.urlAfterRedirects, {
				referrer: document.referrer,
				route: event.urlAfterRedirects,
				load_time_ms: loadTime,
				route_id: this.router.routerState.snapshot.root.firstChild?.routeConfig?.path || '/'
			});

			// Reset for next navigation
			routeStartTime = Date.now(); // Set for next navigation
		});
	}

	/**
	 * Sets up global error tracking to capture frontend exceptions
	 */
	private setupErrorTracking(): void {
		if (!isPlatformBrowser(this.platformId)) return;

		window.addEventListener('error', (event) => {
			this.captureError(event.error || new Error(event.message), {
				source: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				was_global_listener: true
			});
		});

		window.addEventListener('unhandledrejection', (event) => {
			this.captureError(event.reason || new Error('Unhandled Promise rejection'), {
				was_unhandled_rejection: true
			});
		});
	}

	/**
	 * Captures a page view event
	 * @param url - Optional URL override, defaults to current page URL
	 * @param properties - Additional properties to include with the event
	 */
	capturePageview(url?: string, properties: Properties = {}): void {
		if (!this.ensureInitialized()) return;

		// Get the current URL if none provided
		const currentUrl = url || (isPlatformBrowser(this.platformId) ? window.location.href : '');

		posthog.capture('$pageview', {
			current_url: currentUrl,
			...properties
		});
	}

	/**
	 * Captures a custom event using PostHog.
	 * @param eventName - Name of the event to capture
	 * @param properties - Properties to include with the event
	 * @param sendInstantly - Optional flag to send the event instantly
	 */
	captureEvent(eventName: string, properties: Record<string, any> = {}, sendInstantly?: boolean): void {
		if (!this.ensureInitialized()) return;

		posthog.capture(eventName, properties, {
			send_instantly: sendInstantly
		});
	}

	/**
	 * Captures an error or exception
	 * @param error - Error object or error message
	 * @param properties - Additional properties about the error context
	 */
	captureError(error: Error | string, properties: Properties = {}): void {
		if (!this.ensureInitialized()) return;

		const errorProperties = {
			error_message: error instanceof Error ? error.message : error,
			error_type: error instanceof Error ? error.name : 'string',
			error_stack: error instanceof Error ? error.stack : undefined,
			...properties
		};

		posthog.capture('$exception', errorProperties);
	}

	/**
	 * Identifies a user with optional properties
	 * @param distinctId - Unique identifier for the user
	 * @param userProperties - Additional user properties
	 * @param callback - Optional callback function
	 */
	identify(distinctId: string, userProperties: Properties = {}, callback?: () => void): void {
		if (!this.ensureInitialized()) return;

		posthog.identify(distinctId, userProperties, callback);
	}

	/**
	 * Creates an alias for a user
	 * @param alias - The new ID to be linked to the user's existing ID
	 * @param distinctId - Original distinct ID (optional)
	 * @param callback - Optional callback function
	 */
	alias(alias: string, distinctId?: string, callback?: () => void): void {
		if (!this.ensureInitialized()) return;

		if (callback) {
			// For PostHog's API, we need to use the result to call the callback
			const result = posthog.alias(alias, distinctId);
			if (typeof result === 'number') {
				setTimeout(callback, result);
			} else {
				callback();
			}
		} else {
			posthog.alias(alias, distinctId);
		}
	}

	/**
	 * Associates the current user with a group
	 * @param groupType - Type of group (e.g., 'company', 'team')
	 * @param groupKey - Unique identifier for the group
	 * @param groupProperties - Properties to set for this group
	 */
	group(groupType: string, groupKey: string, groupProperties: Properties = {}): void {
		if (!this.ensureInitialized()) return;

		posthog.group(groupType, groupKey, groupProperties);
	}

	/**
	 * Resets the current user, clearing the distinctId and associated data
	 */
	reset(): void {
		posthog.reset();
	}

	/**
	 * Checks if a feature flag is enabled for the current user
	 * @param key - Feature flag key
	 * @param options - Additional options for the feature flag check
	 */
	isFeatureEnabled(key: string, options: { send_event: boolean }): void {
		if (!this.ensureInitialized()) {
			return;
		}

		posthog.isFeatureEnabled(key, options);
	}

	/**
	 * Gets the value of a feature flag for the current user
	 * @param key - Feature flag key
	 * @param defaultValue - Default value if flag is not found
	 * @returns The feature flag value
	 */
	getFeatureFlag(key: string, defaultValue: any = null): any {
		if (!this.ensureInitialized()) return defaultValue;

		return posthog.getFeatureFlag(key, defaultValue);
	}

	/**
	 * Sets a local override for a feature flag (useful for testing)
	 * @param key - Feature flag key
	 * @param value - Value to override with
	 */
	setFeatureFlagOverride(key: string, value: any): void {
		if (!this.ensureInitialized()) return;

		// Using correct method as per PostHog docs
		posthog.featureFlags.override({ [key]: value });
	}

	/**
	 * Reloads all feature flags from the server
	 */
	reloadFeatureFlags(): void {
		if (!this.ensureInitialized()) return;

		posthog.reloadFeatureFlags();
	}

	/**
	 * Reloads all feature flags from the server with callback
	 */
	reloadFeatureFlagsWithCallback(): void {
		if (!this.ensureInitialized()) {
			return;
		}

		posthog.reloadFeatureFlags();
	}

	/**
	 * Retrieves the values of specific feature flags for the current user.
	 * Since PostHog's JavaScript SDK does not support fetching all flags at once,
	 * you must provide a list of known feature flag keys.
	 *
	 * @param keys - Array of feature flag keys to check
	 * @returns An object with keys and their corresponding values
	 */
	getFeatureFlags(keys: string[]): Record<string, boolean | string | undefined> {
		if (!this.ensureInitialized()) return {};

		const flags: Record<string, boolean | string | undefined> = {};
		keys.forEach((key) => {
			flags[key] = posthog.getFeatureFlag(key);
		});
		return flags;
	}

	/**
	 * Manually starts session recording
	 */
	startSessionRecording(): void {
		if (!this.ensureInitialized()) return;

		posthog.startSessionRecording();
	}

	/**
	 * Manually stops session recording
	 */
	stopSessionRecording(): void {
		if (!this.ensureInitialized()) return;

		posthog.stopSessionRecording();
	}

	/**
	 * Register properties that will be sent with every event
	 * @param properties - Super properties to register
	 * @param days - How many days to keep the properties for (optional)
	 */
	register(properties: Properties, days?: number): void {
		if (!this.ensureInitialized()) return;

		posthog.register(properties, days);
	}

	/**
	 * Register properties that will be sent with every event (only if not set before)
	 * @param properties - Super properties to register once
	 * @param defaultValue - Default value if property isn't already set
	 * @param days - How many days to keep the properties for (optional)
	 */
	registerOnce(properties: Properties, defaultValue?: any, days?: number): void {
		if (!this.ensureInitialized()) return;

		posthog.register_once(properties, defaultValue, days);
	}

	/**
	 * Unregister a super property
	 * @param propertyName - Name of property to unregister
	 */
	unregister(propertyName: string): void {
		if (!this.ensureInitialized()) return;

		posthog.unregister(propertyName);
	}

	/**
	 * Get the current user's distinct ID
	 * @returns The current distinct ID
	 */
	getDistinctId(): string {
		if (!this.ensureInitialized()) return '';

		return posthog.get_distinct_id();
	}

	/**
	 * Opt the user out of tracking
	 */
	optOut(): void {
		if (!this.ensureInitialized()) return;

		posthog.opt_out_capturing();
	}

	/**
	 * Opt the user into tracking
	 */
	optIn(): void {
		if (!this.ensureInitialized()) return;

		posthog.opt_in_capturing();
	}

	/**
	 * Check if the user is opted out of tracking
	 * @returns Whether the user is opted out
	 */
	isOptedOut(): boolean {
		if (!this.ensureInitialized()) return false;

		return posthog.has_opted_out_capturing();
	}

	/**
	 * Set person properties
	 * @param properties - Properties to set for the person or property name
	 * @param value - Value if using property name in first param
	 * @param callback - Optional callback function
	 */
	setPersonProperties(properties: Properties | string, value?: string, callback?: () => void): void {
		if (!this.ensureInitialized()) return;

		posthog.people.set(properties, value, callback);
	}

	/**
	 * Set once person properties (only if they are not set)
	 * @param properties - Properties to set once for the person or property name
	 * @param value - Value if using property name in first param
	 * @param callback - Optional callback function
	 */
	setPersonPropertiesOnce(properties: Properties | string, value?: string, callback?: () => void): void {
		if (!this.ensureInitialized()) return;

		posthog.people.set_once(properties, value, callback);
	}

	/**
	 * Set person properties for feature flags computation
	 * @param properties - Properties to set for feature flags
	 */
	setPersonPropertiesForFlags(properties: Properties): void {
		if (!this.ensureInitialized()) return;

		posthog.setPersonPropertiesForFlags(properties);
	}

	/**
	 * Set group properties for feature flags computation
	 * @param groupTypeToPropertiesMap - Object containing group types mapped to their properties
	 * @param reloadFeatureFlags - Whether to reload feature flags after setting properties
	 */
	setGroupPropertiesForFlags(
		groupTypeToPropertiesMap: { [type: string]: Properties },
		reloadFeatureFlags?: boolean
	): void {
		if (!this.ensureInitialized()) return;

		posthog.setGroupPropertiesForFlags(groupTypeToPropertiesMap, reloadFeatureFlags);
	}

	/**
	 * Capture a dead click event
	 * @param element - DOM element that was clicked
	 * @param properties - Additional properties
	 */
	captureDeadClick(element: Element, properties: Properties = {}): void {
		if (!this.ensureInitialized()) return;

		posthog.capture('$dead_click', {
			$element: element.tagName.toLowerCase(),
			$el_text: element.textContent?.trim(),
			...properties
		});
	}

	/**
	 * Checks if PostHog is initialized and logs a warning if not
	 * @returns boolean indicating if PostHog is initialized
	 */
	private ensureInitialized(): boolean {
		if (!this.initialized) {
			console.warn('PostHog not initialized. Call initialize() before using tracking methods.');
			return false;
		}
		return true;
	}

	/**
	 * Gets the raw PostHog instance for advanced usage
	 * @returns The PostHog instance
	 */
	getInstance(): typeof posthog {
		if (!this.ensureInitialized()) return posthog;

		return posthog;
	}
}
