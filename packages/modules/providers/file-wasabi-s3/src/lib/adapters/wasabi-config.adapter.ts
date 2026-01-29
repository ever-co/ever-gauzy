import { ensureHttpPrefix, trimIfNotEmpty, parseToBoolean } from '@gauzy/utils';
import { IWasabiConfig, IWasabiConfigProvider } from '../interfaces';

/**
 * Interface for Wasabi environment configuration.
 * This matches the structure used in @gauzy/config.
 */
export interface IWasabiEnvironment {
	accessKeyId?: string;
	secretAccessKey?: string;
	region?: string;
	serviceUrl?: string;
	s3?: {
		bucket?: string;
		forcePathStyle?: boolean;
	};
}

/**
 * Interface for tenant settings that may contain Wasabi configuration.
 */
export interface ITenantWasabiSettings {
	wasabi_aws_access_key_id?: string;
	wasabi_aws_secret_access_key?: string;
	wasabi_aws_default_region?: string;
	wasabi_aws_service_url?: string;
	wasabi_aws_bucket?: string;
	wasabi_aws_force_path_style?: string | boolean;
}

/**
 * Interface for request context provider.
 * Implement this to provide the current request context.
 */
export interface IRequestContextProvider {
	/**
	 * Get the current HTTP request, if available.
	 */
	currentRequest(): { tenantSettings?: ITenantWasabiSettings } | null;
}

/**
 * Wasabi Configuration Adapter
 *
 * This adapter provides flexible configuration for Wasabi storage by:
 * 1. Reading default configuration from environment
 * 2. Optionally overriding with tenant-specific settings from request context
 *
 * @example
 * // Create adapter with environment config
 * const adapter = new WasabiConfigAdapter({
 *   accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
 *   region: process.env.WASABI_REGION,
 *   s3: {
 *     bucket: process.env.WASABI_BUCKET,
 *     forcePathStyle: true
 *   }
 * });
 *
 * @example
 * // With tenant-aware configuration
 * const adapter = new WasabiConfigAdapter(
 *   environmentConfig,
 *   { currentRequest: () => RequestContext.currentRequest() }
 * );
 */
export class WasabiConfigAdapter implements IWasabiConfigProvider {
	private _defaultConfig: IWasabiConfig;
	private _requestContextProvider: IRequestContextProvider | null;
	private _detailedLogging = false;

	constructor(environment?: IWasabiEnvironment, requestContextProvider?: IRequestContextProvider) {
		this._defaultConfig = this._mapEnvironmentToConfig(environment);
		this._requestContextProvider = requestContextProvider ?? null;
	}

	/**
	 * Enable detailed logging for debugging.
	 */
	setDetailedLogging(enabled: boolean): void {
		this._detailedLogging = enabled;
	}

	/**
	 * Set or update the request context provider.
	 */
	setRequestContextProvider(provider: IRequestContextProvider): void {
		this._requestContextProvider = provider;
	}

	/**
	 * Get the current Wasabi configuration.
	 * If a request context is available and contains tenant settings,
	 * those settings will override the default configuration.
	 */
	getConfig(): IWasabiConfig {
		// Start with default configuration
		let config = { ...this._defaultConfig };

		// Try to get tenant-specific settings
		if (this._requestContextProvider) {
			try {
				const request = this._requestContextProvider.currentRequest();
				if (request?.tenantSettings) {
					config = this._mergeWithTenantSettings(config, request.tenantSettings);
				}
			} catch (error) {
				if (this._detailedLogging) {
					console.warn('[WasabiConfigAdapter] Error reading tenant settings:', error);
				}
			}
		}

		if (this._detailedLogging) {
			console.log('[WasabiConfigAdapter] Resolved config:', {
				...config,
				secretAccessKey: '***'
			});
		}

		return config;
	}

	/**
	 * Map environment configuration to IWasabiConfig.
	 */
	private _mapEnvironmentToConfig(env?: IWasabiEnvironment): IWasabiConfig {
		return {
			accessKeyId: env?.accessKeyId ?? '',
			secretAccessKey: env?.secretAccessKey ?? '',
			region: env?.region,
			serviceUrl: env?.serviceUrl,
			bucket: env?.s3?.bucket ?? '',
			forcePathStyle: env?.s3?.forcePathStyle ?? false,
			rootPath: ''
		};
	}

	/**
	 * Merge default config with tenant-specific settings.
	 */
	private _mergeWithTenantSettings(baseConfig: IWasabiConfig, settings: ITenantWasabiSettings): IWasabiConfig {
		const merged: IWasabiConfig = { ...baseConfig };

		/**
		 * Helper to assign a trimmed string value if present.
		 */
		const assignIfNotEmpty = (setter: (value: string) => void, raw?: string | boolean) => {
			// For non-string values (e.g., booleans), skip trimming logic
			if (typeof raw !== 'string') {
				return;
			}

			const value = trimIfNotEmpty(raw);
			if (value) {
				setter(value);
			}
		};

		assignIfNotEmpty((v) => (merged.accessKeyId = v), settings.wasabi_aws_access_key_id);
		assignIfNotEmpty((v) => (merged.secretAccessKey = v), settings.wasabi_aws_secret_access_key);
		assignIfNotEmpty((v) => (merged.region = v), settings.wasabi_aws_default_region);
		assignIfNotEmpty((v) => (merged.serviceUrl = ensureHttpPrefix(v)), settings.wasabi_aws_service_url);
		assignIfNotEmpty((v) => (merged.bucket = v), settings.wasabi_aws_bucket);

		if (settings.wasabi_aws_force_path_style !== undefined) {
			merged.forcePathStyle = parseToBoolean(settings.wasabi_aws_force_path_style);
		}

		return merged;
	}
}

/**
 * Create a Wasabi config adapter from environment.
 *
 * @param wasabiEnv - Wasabi environment configuration
 * @param requestContextProvider - Optional request context provider for tenant settings
 * @returns IWasabiConfigProvider instance
 */
export function createWasabiConfigAdapter(
	wasabiEnv?: IWasabiEnvironment,
	requestContextProvider?: IRequestContextProvider
): IWasabiConfigProvider {
	return new WasabiConfigAdapter(wasabiEnv, requestContextProvider);
}
