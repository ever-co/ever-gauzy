import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Interface for synchronous PostHog module configuration.
 */
export interface PosthogModuleOptions {
	apiKey: string;
	apiHost?: string;
	enableErrorTracking?: boolean;
	flushAt?: number;
	flushInterval?: number;
	personalApiKey?: string;
	autocapture?: boolean;

	/**
	 * When mock is used, none of the events
	 * are captured, only dumped to console.
	 *
	 * Useful for local development.
	 *
	 * @default false
	 */
	mock: boolean;
}

export interface PosthogSyncConfig {
	// If true, registers `PosthogModule` as a global module.
	isGlobal?: boolean;
}
/**
 * Interface for asynchronous PostHog module configuration.
 */
export interface PosthogModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useFactory?: (...args: any[]) => Promise<PosthogModuleOptions> | PosthogModuleOptions;
	inject?: any[];
	useClass?: Type<PosthogOptionsFactory>;
	useExisting?: Type<PosthogOptionsFactory>;

	// If true, registers `PosthogModule` as a global module.
	isGlobal?: boolean;
}

/**
 * Interface to be implemented by a factory providing PostHog options.
 */
export interface PosthogOptionsFactory {
	createPosthogOptions(): Promise<PosthogModuleOptions> | PosthogModuleOptions;
}
