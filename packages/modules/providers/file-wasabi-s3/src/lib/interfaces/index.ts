/**
 * Configuration interface for Wasabi S3 storage provider.
 */
export interface IWasabiConfig {
	/** AWS access key ID for Wasabi */
	accessKeyId: string;

	/** AWS secret access key for Wasabi */
	secretAccessKey: string;

	/** AWS bucket name for Wasabi */
	bucket: string;

	/** AWS default region for Wasabi (default: 'us-east-1') */
	region?: string;

	/** AWS service URL for Wasabi (optional, auto-mapped from region if not provided) */
	serviceUrl?: string;

	/** Whether to force path style URLs for S3 objects (default: false) */
	forcePathStyle?: boolean;

	/** Root path prefix for all files (default: '') */
	rootPath?: string;
}

/**
 * Interface for providing dynamic/tenant-aware Wasabi configuration.
 * Implement this interface to provide configuration from different sources
 * (e.g., tenant settings, database, external service).
 */
export interface IWasabiConfigProvider {
	/**
	 * Get the Wasabi configuration.
	 * This method is called each time the provider needs to access storage,
	 * allowing for dynamic configuration updates.
	 *
	 * @returns The Wasabi configuration or null if not available
	 */
	getConfig(): IWasabiConfig | null;
}

/**
 * Options for the Wasabi storage module.
 */
export interface IWasabiStorageModuleOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Static configuration (used if configProvider is not provided) */
	config?: IWasabiConfig;

	/** Dynamic configuration provider (takes precedence over static config) */
	configProvider?: IWasabiConfigProvider;
}

/**
 * Async options for the Wasabi storage module.
 */
export interface IWasabiStorageModuleAsyncOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Dependencies to inject into the factory */
	inject?: any[];

	/** Factory function to create the configuration */
	useFactory?: (...args: any[]) => IWasabiStorageModuleOptions | Promise<IWasabiStorageModuleOptions>;

	/** Use an existing provider class */
	useClass?: new (...args: any[]) => IWasabiConfigProvider;

	/** Use an existing provider instance */
	useExisting?: any;
}

/**
 * Interface representing the mapping between a Wasabi region and its associated service URL.
 */
export interface IWasabiRegionServiceURL {
	/** The Wasabi region identifier */
	region: string;

	/** The service URL associated with the Wasabi region */
	serviceUrl: string;
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
