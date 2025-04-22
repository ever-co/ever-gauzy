import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Configuration options for the PostHog module
 */
export interface PosthogModuleOptions {
	apiKey: string;

	/** PostHog API host URL (defaults to https://app.posthog.com) */
	apiHost?: string;

	/** Whether to enable error tracking (defaults to true) */
	enableErrorTracking?: boolean;

	/** Number of events to queue before sending (defaults to 20) */
	flushAt?: number;

	/** Maximum milliseconds to wait before sending data (defaults to 10000) */
	flushInterval?: number;

	/** Personal API key for PostHog */
	personalApiKey?: string;

	/** Whether to automatically capture clicks and form submissions (defaults to false) */
	autocapture?: boolean;

	/** Whether to use a mock client for testing (defaults to false) */
	mock?: boolean;
}

export interface PosthogModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useFactory?: (...args: unknown[]) => Promise<PosthogModuleOptions> | PosthogModuleOptions;
	inject?: (string | symbol | Type<unknown>)[];
	useClass?: Type<PosthogOptionsFactory>;
	useExisting?: Type<PosthogOptionsFactory>;
	isGlobal?: boolean;
}

export interface PosthogOptionsFactory {
	createPosthogOptions(): Promise<PosthogModuleOptions> | PosthogModuleOptions;
}

// Common PostHog property types
export interface PosthogEventProperties {
	// Standard PostHog properties (prefixed with $)
	$ip?: string;
	$timestamp?: string;
	$set?: Record<string, string | number | boolean | null | undefined>;
	$set_once?: Record<string, string | number | boolean | null | undefined>;
	// Custom properties
	[key: string]: any;
}

export interface PosthogEvent {
	name: string;
	distinctId: string;
	properties: PosthogEventProperties;
}

export interface PosthogInterceptorOptions {
	/**
	 * Filters to determine which exceptions should not be reported
	 */
	filters?: PosthogInterceptorOptionsFilter[];

	/**
	 * Indicates if tags should be included for better categorization
	 * @default true
	 */
	includeTags?: boolean;

	/**
	 * Limits the size of captured objects (in characters)
	 * @default 10000
	 */
	maxObjectSize?: number;

	/**
	 * List of header keys to never capture (for privacy reasons)
	 */
	sensitiveHeaders?: string[];

	/**
	 * Detail level for error capturing
	 * - basic: error message and status code only
	 * - standard: basic details plus request context
	 * - detailed: all available information
	 * @default 'standard'
	 */
	detailLevel?: 'basic' | 'standard' | 'detailed';
}

export interface PosthogInterceptorOptionsFilter {
	type: any;
	filter?: (exception: Error | unknown) => boolean;
}

/**
 * Custom properties that can be added to all events
 */
export interface PosthogCustomProperties {
	// Add some common properties your application uses
	environment?: string;
	version?: string;
	userRole?: string;
	// Allow additional custom properties
	[key: string]: any;
}

/**
 * Configuration options for the PostHogEventInterceptor
 */
export interface PosthogEventInterceptorOptions {
	/**
	 * Paths that should be ignored for event tracking
	 */
	ignoredPaths?: string[];

	/**
	 * Whether to track request performance metrics
	 */
	trackPerformance?: boolean;

	/**
	 * Whether to track user information when available
	 */
	trackUserInfo?: boolean;

	/**
	 * Custom properties to add to all events
	 */
	customProperties?: PosthogCustomProperties;
}

/**
 * Parses and validates PostHog options
 * @param options Raw PostHog options
 * @returns Normalized PostHog options
 */
export const parsePosthogOptions = (options: PosthogModuleOptions): PosthogModuleOptions => {
	// Validate required options
	if (!options.apiKey) {
		throw new Error('PostHog API key is required');
	}

	// Validate numeric values
	const flushAt = options.flushAt ?? 20;
	if (flushAt <= 0) {
		throw new Error('flushAt must be a positive number');
	}

	const flushInterval = options.flushInterval ?? 10000;
	if (flushInterval <= 0) {
		throw new Error('flushInterval must be a positive number');
	}

	return {
		apiKey: options.apiKey,
		apiHost: options.apiHost ?? 'https://app.posthog.com',
		enableErrorTracking: options.enableErrorTracking ?? true,
		flushAt,
		flushInterval,
		personalApiKey: options.personalApiKey,
		autocapture: options.autocapture ?? false,
		mock: options.mock ?? false
	};
};
