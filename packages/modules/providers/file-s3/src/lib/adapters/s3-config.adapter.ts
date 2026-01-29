import { ensureHttpPrefix, trimIfNotEmpty, parseToBoolean } from '@gauzy/utils';
import { IS3Config, IS3ConfigProvider, ITenantS3Settings, IRequestContextProvider } from '../interfaces';

/**
 * Interface for S3 environment configuration.
 * This matches the structure used in @gauzy/config.
 */
export interface IS3Environment {
	accessKeyId?: string;
	secretAccessKey?: string;
	region?: string;
	serviceUrl?: string;
	bucket?: string;
	forcePathStyle?: boolean;
}

/**
 * S3 Configuration Adapter
 *
 * This adapter provides flexible configuration for AWS S3 storage by:
 * 1. Reading default configuration from environment
 * 2. Optionally overriding with tenant-specific settings from request context
 *
 * @example
 * // Create adapter with environment config
 * const adapter = new S3ConfigAdapter({
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 *   region: process.env.AWS_REGION,
 *   bucket: process.env.AWS_S3_BUCKET,
 *   forcePathStyle: false
 * });
 *
 * @example
 * // With tenant-aware configuration
 * const adapter = new S3ConfigAdapter(
 *   environmentConfig,
 *   { currentRequest: () => RequestContext.currentRequest() }
 * );
 */
export class S3ConfigAdapter implements IS3ConfigProvider {
	private _defaultConfig: IS3Config;
	private _requestContextProvider: IRequestContextProvider | null;
	private _detailedLogging = false;

	constructor(environment?: IS3Environment, requestContextProvider?: IRequestContextProvider) {
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
	 * Get the current S3 configuration.
	 * If a request context is available and contains tenant settings,
	 * those settings will override the default configuration.
	 */
	getConfig(): IS3Config {
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
					console.warn('[S3ConfigAdapter] Error reading tenant settings:', error);
				}
			}
		}

		if (this._detailedLogging) {
			console.log('[S3ConfigAdapter] Resolved config:', {
				...config,
				secretAccessKey: '***'
			});
		}

		return config;
	}

	/**
	 * Map environment configuration to IS3Config.
	 */
	private _mapEnvironmentToConfig(env?: IS3Environment): IS3Config {
		return {
			accessKeyId: env?.accessKeyId ?? '',
			secretAccessKey: env?.secretAccessKey ?? '',
			region: env?.region,
			serviceUrl: env?.serviceUrl,
			bucket: env?.bucket ?? '',
			forcePathStyle: env?.forcePathStyle ?? false,
			rootPath: ''
		};
	}

	/**
	 * Merge default config with tenant-specific settings.
	 */
	private _mergeWithTenantSettings(baseConfig: IS3Config, settings: ITenantS3Settings): IS3Config {
		const merged = { ...baseConfig };

		const accessKeyId = trimIfNotEmpty(settings.aws_access_key_id);
		if (accessKeyId) {
			merged.accessKeyId = accessKeyId;
		}

		const secretAccessKey = trimIfNotEmpty(settings.aws_secret_access_key);
		if (secretAccessKey) {
			merged.secretAccessKey = secretAccessKey;
		}

		const region = trimIfNotEmpty(settings.aws_default_region);
		if (region) {
			merged.region = region;
		}

		const bucket = trimIfNotEmpty(settings.aws_bucket);
		if (bucket) {
			merged.bucket = bucket;
		}

		if (settings.aws_force_path_style !== undefined) {
			merged.forcePathStyle = parseToBoolean(settings.aws_force_path_style);
		}

		return merged;
	}
}

/**
 * Create an S3 config adapter from environment.
 *
 * @param s3Env - S3 environment configuration
 * @param requestContextProvider - Optional request context provider for tenant settings
 * @returns IS3ConfigProvider instance
 */
export function createS3ConfigAdapter(
	s3Env?: IS3Environment,
	requestContextProvider?: IRequestContextProvider
): IS3ConfigProvider {
	return new S3ConfigAdapter(s3Env, requestContextProvider);
}
