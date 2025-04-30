import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import posthog, { PostHogConfig, Properties } from 'posthog-js';

/**
 * Complete PostHog service for Angular applications
 * Provides integration with all PostHog features including:
 * - Event tracking
 * - User identification
 * - Feature flags
 * - Session recording
 * - Heat maps
 * - Group analytics
 * - Funnel analysis
 * - Error monitoring
 * - Page views
 */
@Injectable({
	providedIn: 'root'
})
export class PostHogService {
	private initialized = false;
	private config: Partial<PostHogConfig> = {};

	constructor(private router: Router, @Inject(PLATFORM_ID) private platformId: object) {}

	/**
	 * Initializes PostHog with API key and configuration options
	 * @param apiKey - Your PostHog API key
	 * @param config - Configuration options for PostHog
	 */
	initialize(apiKey: string, config: Partial<PostHogConfig> = {}): boolean {
		// Only initialize in browser environment to prevent SSR issues
		if (isPlatformBrowser(this.platformId) && !this.initialized) {
			this.config = {
				api_host: config.api_host || 'https://app.posthog.com',
				capture_pageview: false, // We'll handle page views manually for more control
				...config
			};

			// Initialize PostHog with API key and configuration
			posthog.init(apiKey, this.config);
			this.initialized = true;

			// Attach error tracking if not explicitly disabled
			if (config.capture_exceptions !== false) {
				this.setupErrorTracking();
			}

			return true;
		}
		return false;
	}

	/**
	 * Returns whether PostHog has been initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Sets up automatic tracking of page views when navigation completes
	 * Includes route information and timing metrics
	 */
	/**
	 * Sets up automatic tracking of route changes
	 */
	setupRouteTracking(router: Router = this.router): void {
		if (!isPlatformBrowser(this.platformId) || !this.initialized || (this as any)._routeTrackingAttached) return;

		(this as any)._routeTrackingAttached = true;

		let routeStartTime = Date.now();
		router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				routeStartTime = Date.now();
			}
			if (event instanceof NavigationEnd) {
				const loadTime = Date.now() - routeStartTime;
				this.capturePageview(event.urlAfterRedirects, {
					load_time_ms: loadTime,
					referrer: document.referrer,
					route: event.urlAfterRedirects,
					route_id: router.routerState.snapshot.root.firstChild?.routeConfig?.path || '/'
				});
			}
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
		if (!this.initialized) return;

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
	captureEvent(eventName: string, properties: Properties = {}, sendInstantly?: boolean): void {
		if (!this.initialized) return;

		posthog.capture(
			eventName,
			properties,
			sendInstantly !== undefined ? { send_instantly: sendInstantly } : undefined
		);
	}

	/**
	 * Captures an error or exception
	 * @param error - Error object or error message
	 * @param properties - Additional properties about the error context
	 */
	captureError(error: Error | string, properties: Properties = {}): void {
		if (!this.initialized) return;

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
		if (!this.initialized) return;

		posthog.identify(distinctId, userProperties, callback);
	}

	/**
	 * Creates an alias for a user
	 * @param alias - The new ID to be linked to the user's existing ID
	 * @param distinctId - Original distinct ID (optional)
	 * @param callback - Optional callback function
	 */
	alias(alias: string, distinctId?: string, callback?: () => void): void {
		if (!this.initialized) return;

		posthog.alias(alias, distinctId);
		callback?.();
	}

	/**
	 * Associates the current user with a group
	 * @param groupType - Type of group (e.g., 'company', 'team')
	 * @param groupKey - Unique identifier for the group
	 * @param groupProperties - Properties to set for this group
	 */
	group(groupType: string, groupKey: string, groupProperties: Properties = {}): void {
		if (!this.initialized) return;

		posthog.group(groupType, groupKey, groupProperties);
	}

	/**
	 * Resets the current user, clearing the distinctId and associated data
	 */
	reset(): void {
		if (!this.initialized) return;
		posthog.reset();
	}

	/**
	 * Checks if a feature flag is enabled for the current user
	 * @param key - Feature flag key
	 * @param options - Additional options for the feature flag check
	 */
	isFeatureEnabled(key: string, options: { send_event: boolean }): boolean | undefined {
		if (!this.initialized) {
			return;
		}

		return posthog.isFeatureEnabled(key, options);
	}

	/**
	 * Gets the value of a feature flag for the current user
	 * @param key - Feature flag key
	 * @param defaultValue - Default value if flag is not found
	 * @returns The feature flag value
	 */
	getFeatureFlag(key: string, defaultValue: any = null): any {
		if (!this.initialized) return defaultValue;

		return posthog.getFeatureFlag(key, defaultValue);
	}

	/**
	 * Sets a local override for a feature flag (useful for testing)
	 * @param key - Feature flag key
	 * @param value - Value to override with
	 */
	setFeatureFlagOverride(key: string, value: any): void {
		if (!this.initialized) return;

		// Using correct method as per PostHog docs
		posthog.featureFlags.override({ [key]: value });
	}

	/**
	 * Reloads all feature flags from the server
	 */
	reloadFeatureFlags(): void {
		if (!this.initialized) return;

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
		if (!this.initialized) return {};

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
		if (!this.initialized) return;

		posthog.startSessionRecording();
	}

	/**
	 * Manually stops session recording
	 */
	stopSessionRecording(): void {
		if (!this.initialized) return;

		posthog.stopSessionRecording();
	}

	/**
	 * Register properties that will be sent with every event
	 * @param properties - Super properties to register
	 * @param days - How many days to keep the properties for (optional)
	 */
	register(properties: Properties, days?: number): void {
		if (!this.initialized) return;

		posthog.register(properties, days);
	}

	/**
	 * Register properties that will be sent with every event (only if not set before)
	 * @param properties - Super properties to register once
	 * @param defaultValue - Default value if property isn't already set
	 * @param days - How many days to keep the properties for (optional)
	 */
	registerOnce(properties: Properties, defaultValue?: any, days?: number): void {
		if (!this.initialized) return;

		posthog.register_once(properties, defaultValue, days);
	}

	/**
	 * Unregister a super property
	 * @param propertyName - Name of property to unregister
	 */
	unregister(propertyName: string): void {
		if (!this.initialized) return;

		posthog.unregister(propertyName);
	}

	/**
	 * Get the current user's distinct ID
	 * @returns The current distinct ID
	 */
	getDistinctId(): string {
		if (!this.initialized) return '';

		return posthog.get_distinct_id();
	}

	/**
	 * Opt the user out of tracking
	 */
	optOut(): void {
		if (!this.initialized) return;

		posthog.opt_out_capturing();
	}

	/**
	 * Opt the user into tracking
	 */
	optIn(): void {
		if (!this.initialized) return;

		posthog.opt_in_capturing();
	}

	/**
	 * Check if the user is opted out of tracking
	 * @returns Whether the user is opted out
	 */
	isOptedOut(): boolean {
		if (!this.initialized) return false;

		return posthog.has_opted_out_capturing();
	}

	/**
	 * Set person properties
	 * @param properties - Properties to set for the person or property name
	 * @param value - Value if using property name in first param
	 * @param callback - Optional callback function
	 */
	setPersonProperties(properties: Properties | string, value?: string, callback?: () => void): void {
		if (!this.initialized) return;

		posthog.people.set(properties, value, callback);
	}

	/**
	 * Set once person properties (only if they are not set)
	 * @param properties - Properties to set once for the person or property name
	 * @param value - Value if using property name in first param
	 * @param callback - Optional callback function
	 */
	setPersonPropertiesOnce(properties: Properties | string, value?: string, callback?: () => void): void {
		if (!this.initialized) return;

		posthog.people.set_once(properties, value, callback);
	}

	/**
	 * Set person properties for feature flags computation
	 * @param properties - Properties to set for feature flags
	 */
	setPersonPropertiesForFlags(properties: Properties): void {
		if (!this.initialized) return;

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
		if (!this.initialized) return;

		posthog.setGroupPropertiesForFlags(groupTypeToPropertiesMap, reloadFeatureFlags);
	}

	/**
	 * Capture a dead click event
	 * @param element - DOM element that was clicked
	 * @param properties - Additional properties
	 */
	captureDeadClick(element: Element, properties: Properties = {}): void {
		if (!this.initialized) return;

		posthog.capture('$dead_click', {
			$element: element.tagName.toLowerCase(),
			$el_text: element.textContent?.trim(),
			...properties
		});
	}

	/**
	 * Gets the raw PostHog instance for advanced usage
	 * @returns The PostHog instance
	 */
	getInstance(): typeof posthog {
		return posthog;
	}
}
