import { ModuleMetadata, Type } from '@nestjs/common';

export interface PosthogModuleOptions {
	apiKey: string;
	apiHost?: string;
	enableErrorTracking?: boolean;
	flushAt?: number;
	flushInterval?: number;
	personalApiKey?: string;
	autocapture?: boolean;
	mock?: boolean;
}

export interface PosthogModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useFactory?: (...args: unknown[]) => Promise<PosthogModuleOptions> | PosthogModuleOptions;
	inject?: (string | symbol | Type<any>)[];
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
	$set?: Record<string, any>;
	$set_once?: Record<string, any>;
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
	filter?: (exception: any) => boolean;
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
	customProperties?: Record<string, any>;
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
		apiHost: options.apiHost || 'https://app.posthog.com',
		enableErrorTracking: options.enableErrorTracking ?? true,
		flushAt,
		flushInterval,
		personalApiKey: options.personalApiKey,
		autocapture: options.autocapture ?? false,
		mock: options.mock ?? false
	};
};
