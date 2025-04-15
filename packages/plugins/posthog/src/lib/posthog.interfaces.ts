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
	useFactory?: (...args: any[]) => Promise<PosthogModuleOptions> | PosthogModuleOptions;
	inject?: any[];
	useClass?: Type<PosthogOptionsFactory>;
	useExisting?: Type<PosthogOptionsFactory>;
	isGlobal?: boolean;
}

export interface PosthogOptionsFactory {
	createPosthogOptions(): Promise<PosthogModuleOptions> | PosthogModuleOptions;
}

export interface PosthogEvent {
	name: string;
	distinctId: string;
	properties: Record<string, any>;
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
	return {
		apiKey: options.apiKey,
		apiHost: options.apiHost || 'https://app.posthog.com',
		enableErrorTracking: options.enableErrorTracking ?? true,
		flushAt: options.flushAt || 20,
		flushInterval: options.flushInterval || 10000,
		personalApiKey: options.personalApiKey,
		autocapture: options.autocapture ?? false,
		mock: options.mock ?? false
	};
};
