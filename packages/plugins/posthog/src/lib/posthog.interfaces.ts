import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Interface for synchronous PostHog module configuration.
 */
export interface PosthogModuleOptions {
	apiKey: string;
	apiHost?: string;
	enableErrorTracking?: boolean;
}

/**
 * Interface for asynchronous PostHog module configuration.
 */
export interface PosthogModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useFactory?: (...args: any[]) => Promise<PosthogModuleOptions> | PosthogModuleOptions;
	inject?: any[];
	useClass?: Type<PosthogOptionsFactory>;
	useExisting?: Type<PosthogOptionsFactory>;
}

/**
 * Interface to be implemented by a factory providing PostHog options.
 */
export interface PosthogOptionsFactory {
	createPosthogOptions(): Promise<PosthogModuleOptions> | PosthogModuleOptions;
}
