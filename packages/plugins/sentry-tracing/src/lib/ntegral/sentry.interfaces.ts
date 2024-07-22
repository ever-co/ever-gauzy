import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { Integration, Options } from '@sentry/types';
import { ConsoleLoggerOptions } from '@nestjs/common';
import { SeverityLevel } from '@sentry/node';

/**
 * Interface for Sentry close options.
 */
export interface SentryCloseOptions {
	/**
	 * Determines if the close feature is enabled.
	 */
	enabled: boolean;

	/**
	 * Maximum time in milliseconds the client should wait until closing forcefully.
	 * Optional.
	 */
	timeout?: number;
}

/**
 * Sentry module options.
 */
export type SentryModuleOptions = Omit<Options, 'integrations'> & {
	/**
	 * Array of integrations.
	 */
	integrations?: Integration[];

	/**
	 * Sentry close options.
	 */
	close?: SentryCloseOptions;

	/**
	 * Sample rate for profiling.
	 */
	profilesSampleRate?: number;
} & ConsoleLoggerOptions;

/**
 * Interface for a factory that creates Sentry module options.
 */
export interface SentryOptionsFactory {
	/**
	 * Asynchronous or synchronous method to create Sentry module options.
	 * @returns A Promise containing Sentry module options or the options directly.
	 */
	createSentryModuleOptions(): Promise<SentryModuleOptions> | SentryModuleOptions;
}

/**
 * Interface for asynchronous options to configure the Sentry module.
 */
export interface SentryModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	/**
	 * An array of providers to be injected and used in the module.
	 */
	inject?: any[];

	/**
	 * A class which implements the SentryOptionsFactory interface.
	 */
	useClass?: Type<SentryOptionsFactory>;

	/**
	 * A token of an existing provider to use.
	 */
	useExisting?: Type<SentryOptionsFactory>;

	/**
	 * A factory function that returns either a Promise or a value.
	 */
	useFactory?: (...args: any[]) => Promise<SentryModuleOptions> | SentryModuleOptions;
}

/**
 * Type representing various options for Sentry transactions.
 */
export type SentryTransaction = boolean | 'path' | 'methodPath' | 'handler';

/**
 * Function signature for a Sentry filter function.
 */
export interface SentryFilterFunction {
	(exception: any): boolean;
}

/**
 * Options for filtering Sentry interceptors.
 */
export interface SentryInterceptorOptionsFilter {
	type: any;
	filter?: SentryFilterFunction;
}

/**
 * Options for configuring Sentry interceptors.
 */
export interface SentryInterceptorOptions {
	filters?: SentryInterceptorOptionsFilter[];
	tags?: { [key: string]: string };
	extra?: { [key: string]: any };
	fingerprint?: string[];
	level?: SeverityLevel;

	// https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/handlers.ts#L163
	/**
	 * Enable or configure Sentry request tracking.
	 */
	request?: boolean;

	/**
	 * Enable or configure Sentry server name tracking.
	 */
	serverName?: boolean;

	/**
	 * Configure Sentry transaction tracking.
	 */
	transaction?: SentryTransaction; // https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/handlers.ts#L16

	/**
	 * Configure Sentry user tracking.
	 */
	user?: boolean | string[];

	/**
	 * Enable or configure Sentry version tracking.
	 */
	version?: boolean;
}
