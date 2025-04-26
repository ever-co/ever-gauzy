import { InjectionToken } from '@angular/core';
import { PostHogConfig, Properties } from 'posthog-js';

/**
 * Configuration interface for PostHog initialization
 */
export interface PostHogModuleConfig {
	apiKey: string;
	options?: Partial<PostHogConfig>;
	debug?: boolean;
	/**
	 * Enable or disable tracking for specific routes
	 * - When excluded is provided, tracking is disabled for matching routes
	 * - When included is provided, tracking is enabled ONLY for matching routes
	 * If both are provided, excluded takes precedence
	 */
	routeTracking?: {
		excluded?: Array<string | RegExp>;
		included?: Array<string | RegExp>;
	};
	/**
	 * Configuration for HTTP request tracking
	 */
	httpTracking?: {
		/**
		 * Whether to track API response bodies (use with caution - may contain sensitive data)
		 */
		captureResponseBodies?: boolean; // defaults to false
		/**
		 * Exclude specific routes from tracking
		 */
		excludeUrls?: Array<string | RegExp>;
		/**
		 * Custom properties to include with API tracking events
		 */
		additionalProperties?: Properties;
	};
}

/**
 * Injection token for providing PostHog configuration
 */
export const POSTHOG_CONFIG = new InjectionToken<PostHogModuleConfig>('POSTHOG_CONFIG');

/**
 * Injection token for debug mode
 */
export const POSTHOG_DEBUG_MODE = new InjectionToken<boolean>('POSTHOG_DEBUG_MODE');

/**
 * Feature flag type definitions for better type safety
 */
export interface PostHogFeatureFlags {
	[flagName: string]: boolean | string | number | null;
}
