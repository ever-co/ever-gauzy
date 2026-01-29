/**
 * Configuration interface for AWS S3 storage provider.
 */
export interface IS3Config {
	/** AWS access key ID */
	accessKeyId: string;

	/** AWS secret access key */
	secretAccessKey: string;

	/** S3 bucket name */
	bucket: string;

	/** AWS region (default: 'us-east-1') */
	region?: string;

	/** Custom service URL (optional, for S3-compatible storage like MinIO, LocalStack, etc.) */
	serviceUrl?: string;

	/** Whether to force path style URLs for S3 objects (default: false) */
	forcePathStyle?: boolean;

	/** Root path prefix for all files (default: '') */
	rootPath?: string;
}

/**
 * Interface for providing dynamic/tenant-aware S3 configuration.
 * Implement this interface to provide configuration from different sources
 * (e.g., tenant settings, database, external service).
 */
export interface IS3ConfigProvider {
	/**
	 * Get the S3 configuration.
	 * This method is called each time the provider needs to access storage,
	 * allowing for dynamic configuration updates.
	 *
	 * @returns The S3 configuration or null if not available
	 */
	getConfig(): IS3Config | null;
}

/**
 * Options for the S3 storage module.
 */
export interface IS3StorageModuleOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Static configuration (used if configProvider is not provided) */
	config?: IS3Config;

	/** Dynamic configuration provider (takes precedence over static config) */
	configProvider?: IS3ConfigProvider;
}

/**
 * Async options for the S3 storage module.
 */
export interface IS3StorageModuleAsyncOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Dependencies to inject into the factory */
	inject?: any[];

	/** Factory function to create the configuration */
	useFactory?: (...args: any[]) => IS3StorageModuleOptions | Promise<IS3StorageModuleOptions>;

	/** Use an existing provider class */
	useClass?: new (...args: any[]) => IS3ConfigProvider;

	/** Use an existing provider instance */
	useExisting?: any;
}

/**
 * Interface for tenant settings that may contain S3 configuration.
 */
export interface ITenantS3Settings {
	aws_access_key_id?: string;
	aws_secret_access_key?: string;
	aws_default_region?: string;
	aws_bucket?: string;
	aws_force_path_style?: string | boolean;
}

/**
 * Interface for request context provider.
 * Implement this to provide the current request context.
 */
export interface IRequestContextProvider {
	/**
	 * Get the current HTTP request, if available.
	 */
	currentRequest(): { tenantSettings?: ITenantS3Settings } | null;
}

/**
 * File storage option interface for multer configuration.
 */
export interface IFileStorageOption {
	/** Destination path or function returning destination */
	dest: string | ((file: Express.Multer.File) => string);

	/** Filename or function returning filename */
	filename?: string | ((file: Express.Multer.File, extension: string) => string);

	/** Prefix for auto-generated filenames (default: 'file') */
	prefix?: string;
}

/**
 * Uploaded file interface.
 */
export interface IUploadedFile {
	/** Original file name */
	originalname?: string;

	/** Encoding type */
	encoding?: string;

	/** MIME type */
	mimetype?: string;

	/** File size in bytes */
	size?: number;

	/** Destination path */
	destination?: string;

	/** Generated filename */
	filename?: string;

	/** Full path to the file */
	path?: string;

	/** Storage key (for cloud storage) */
	key?: string;

	/** Public URL of the file */
	url?: string;
}
