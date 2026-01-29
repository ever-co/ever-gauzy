/**
 * Configuration interface for Local file storage provider.
 */
export interface ILocalConfig {
	/** Root path for file storage (default: 'public') */
	rootPath?: string;

	/** Base URL for serving files (e.g., 'http://localhost:3000') */
	baseUrl?: string;

	/** Public path prefix for URLs (default: 'public') */
	publicPath?: string;
}

/**
 * Configuration interface for Local file storage provider from tenant settings.
 * This interface is used to store local storage configuration in tenant settings database.
 * Property names use snake_case to match database column naming conventions.
 */
export interface ILocalFileStorageProviderConfig {
	/** Root path for file storage */
	local_root_path?: string;

	/** Base URL for serving files */
	local_base_url?: string;

	/** Public path prefix for URLs */
	local_public_path?: string;
}

/**
 * Interface for providing dynamic/tenant-aware Local storage configuration.
 * Implement this interface to provide configuration from different sources
 * (e.g., tenant settings, database, external service).
 */
export interface ILocalConfigProvider {
	/**
	 * Get the Local storage configuration.
	 * This method is called each time the provider needs to access storage,
	 * allowing for dynamic configuration updates.
	 *
	 * @returns The Local configuration or null if not available
	 */
	getConfig(): ILocalConfig | null;
}

/**
 * Options for the Local storage module.
 */
export interface ILocalStorageModuleOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Static configuration (used if configProvider is not provided) */
	config?: ILocalConfig;

	/** Dynamic configuration provider (takes precedence over static config) */
	configProvider?: ILocalConfigProvider;
}

/**
 * Async options for the Local storage module.
 */
export interface ILocalStorageModuleAsyncOptions {
	/** Whether to register the module globally */
	isGlobal?: boolean;

	/** Dependencies to inject into the factory */
	inject?: any[];

	/** Factory function to create the configuration */
	useFactory?: (...args: any[]) => ILocalStorageModuleOptions | Promise<ILocalStorageModuleOptions>;

	/** Use an existing provider class */
	useClass?: new (...args: any[]) => ILocalConfigProvider;

	/** Use an existing provider instance */
	useExisting?: any;
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

	/** Storage key */
	key?: string;

	/** Public URL of the file */
	url?: string;
}
