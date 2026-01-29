import { ILocalConfig, ILocalConfigProvider } from '../interfaces';

/**
 * Interface for Local environment configuration.
 * This matches the structure used in @gauzy/config.
 */
export interface ILocalEnvironment {
	baseUrl?: string;
	rootPath?: string;
	publicPath?: string;
}

/**
 * Local Configuration Adapter
 *
 * This adapter provides flexible configuration for Local storage by:
 * 1. Reading default configuration from environment
 *
 * @example
 * // Create adapter with environment config
 * const adapter = new LocalConfigAdapter({
 *   rootPath: process.env.STORAGE_PATH,
 *   baseUrl: process.env.BASE_URL,
 *   publicPath: 'public'
 * });
 */
export class LocalConfigAdapter implements ILocalConfigProvider {
	private _defaultConfig: ILocalConfig;

	constructor(environment?: ILocalEnvironment) {
		this._defaultConfig = this._mapEnvironmentToConfig(environment);
	}

	/**
	 * Get the current Local storage configuration.
	 */
	getConfig(): ILocalConfig {
		// Start with default configuration
		const config = { ...this._defaultConfig };
		return config;
	}

	/**
	 * Map environment configuration to ILocalConfig.
	 */
	private _mapEnvironmentToConfig(env?: ILocalEnvironment): ILocalConfig {
		return {
			rootPath: env?.rootPath ?? 'public',
			baseUrl: env?.baseUrl ?? '',
			publicPath: env?.publicPath ?? 'public'
		};
	}
}

/**
 * Create a Local config adapter from environment.
 *
 * @param localEnv - Local environment configuration
 * @returns ILocalConfigProvider instance
 */
export function createLocalConfigAdapter(localEnv?: ILocalEnvironment): ILocalConfigProvider {
	return new LocalConfigAdapter(localEnv);
}
