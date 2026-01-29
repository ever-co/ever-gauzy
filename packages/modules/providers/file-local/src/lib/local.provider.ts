import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import * as multer from 'multer';
import * as fs from 'fs';
import { basename, join, resolve } from 'path';
import { StorageEngine } from 'multer';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from '@gauzy/contracts';
import { Provider } from './provider';
import { ILocalConfig, ILocalConfigProvider, ILocalFileStorageProviderConfig } from './interfaces';
import {
	LOCAL_CONFIG,
	LOCAL_CONFIG_PROVIDER,
	DEFAULT_ROOT_PATH,
	DEFAULT_PUBLIC_PATH,
	DEFAULT_BASE_URL
} from './constants';

/**
 * Generate a unique filename with timestamp and random suffix.
 */
function generateUniqueFilename(prefix: string, extension: string): string {
	const timestamp = Math.floor(Date.now() / 1000);
	const randomSuffix = Math.floor(Math.random() * 1000);
	return `${prefix}-${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Normalize a file path by replacing backslashes with forward slashes.
 */
function normalizeFilePath(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}

/**
 * Local File Storage Provider
 *
 * A flexible and reusable storage provider for local file system storage.
 * This provider can be used standalone or with dependency injection.
 *
 * Features:
 * - Fully compatible with @gauzy/core FileStorage system
 * - Standalone usage without any framework
 * - NestJS dependency injection support
 * - Dynamic/tenant-aware configuration
 * - Multer integration for file uploads
 *
 * @example
 * // Standalone usage
 * const provider = new LocalProvider();
 * provider.setConfig({
 *   rootPath: '/var/www/public',
 *   baseUrl: 'http://localhost:3000',
 *   publicPath: 'public'
 * });
 *
 * @example
 * // With NestJS DI
 * @Injectable()
 * class MyService {
 *   constructor(private readonly localProvider: LocalProvider) {}
 * }
 */
@Injectable()
export class LocalProvider extends Provider<LocalProvider> {
	/**
	 * Provider name matching FileStorageProviderEnum.LOCAL
	 * Required for integration with core FileStorage system
	 */
	public readonly name = FileStorageProviderEnum.LOCAL;

	/**
	 * Singleton instance
	 */
	public instance: LocalProvider;

	/**
	 * Current configuration in FileSystem format for core compatibility
	 */
	public config: FileSystem & ILocalFileStorageProviderConfig;

	private _staticConfig: ILocalConfig | null = null;
	private _configProvider: ILocalConfigProvider | null = null;
	private _detailedLoggingEnabled = false;

	constructor(
		@Optional() @Inject(LOCAL_CONFIG) staticConfig?: ILocalConfig,
		@Optional() @Inject(LOCAL_CONFIG_PROVIDER) configProvider?: ILocalConfigProvider
	) {
		super();
		this._staticConfig = staticConfig ?? null;
		this._configProvider = configProvider ?? null;
		this.config = this._createEmptyConfig();
	}

	/**
	 * Set static configuration directly.
	 * Use this for standalone usage without dependency injection.
	 *
	 * @param config - The Local storage configuration
	 */
	public setConfig(config: ILocalConfig): void {
		this._staticConfig = config;
		this._refreshConfig();
	}

	/**
	 * Set a dynamic configuration provider.
	 * The provider will be called each time configuration is needed.
	 *
	 * @param provider - The configuration provider
	 */
	public setConfigProvider(provider: ILocalConfigProvider): void {
		this._configProvider = provider;
	}

	/**
	 * Enable or disable detailed logging.
	 *
	 * @param enabled - Whether to enable detailed logging
	 */
	public setDetailedLogging(enabled: boolean): void {
		this._detailedLoggingEnabled = enabled;
	}

	/**
	 * Get the singleton instance of LocalProvider.
	 * Required by core FileStorage system.
	 *
	 * @returns The provider instance
	 */
	public getProviderInstance(): LocalProvider {
		if (!this.instance) {
			this.instance = this;
		}

		this._refreshConfig();
		return this.instance;
	}

	/**
	 * Generates a URL for a given file URL.
	 * If the file URL is already an external URL (starts with 'http'), returns the original URL.
	 * If the file URL is relative, constructs a URL using the public path and base URL.
	 *
	 * @param fileURL - The file URL for which to generate a URL.
	 * @returns A Promise resolving to a string representing the generated URL.
	 */
	public async url(fileURL: string): Promise<string | null> {
		if (!fileURL) {
			return null;
		}

		// If the file URL is already an external URL, return the original URL
		if (fileURL.startsWith('http://') || fileURL.startsWith('https://')) {
			return fileURL;
		}

		this._refreshConfig();

		const publicPath = this.config.local_public_path || DEFAULT_PUBLIC_PATH;
		const baseUrl = this.config.local_base_url || '';

		// If base URL is provided, construct absolute URL
		if (baseUrl) {
			try {
				return new URL(join(publicPath, fileURL), baseUrl).toString();
			} catch {
				return `${baseUrl}/${publicPath}/${fileURL}`.replace(/\/+/g, '/').replace(':/', '://');
			}
		}

		// Return relative URL
		return `/${publicPath}/${fileURL}`.replace(/\/+/g, '/');
	}

	/**
	 * Gets the full path of the file storage by joining the root path with the provided file path.
	 *
	 * @param filePath - The file path for which to get the full path.
	 * @returns The full path of the file storage or null if the file path is falsy.
	 */
	public path(filePath: string): string | null {
		if (!filePath) {
			return null;
		}

		this._refreshConfig();
		return join(this.config.rootPath || DEFAULT_ROOT_PATH, filePath);
	}

	/**
	 * Creates and returns a multer storage engine based on the provided options.
	 *
	 * @param options - The options for configuring the multer storage engine.
	 * @returns A multer storage engine.
	 */
	public handler(options: FileStorageOption): StorageEngine | null {
		const { dest, filename, prefix = 'file' } = options;

		try {
			this._refreshConfig();

			return multer.diskStorage({
				destination: (_req, file, callback) => {
					// A string or function that determines the destination path for uploaded files
					const dir = typeof dest === 'function' ? (dest as Function)(file) : dest;

					// Ensure the destination directory exists, create if not
					const fullPath = join(this.config.rootPath || DEFAULT_ROOT_PATH, dir);
					fs.mkdirSync(fullPath, { recursive: true });

					callback(null, fullPath);
				},
				filename: (_req, file, callback) => {
					// Get file extension
					const extension = file.originalname.split('.').pop() ?? '';

					// Generate filename
					let generatedFilename: string;
					if (filename) {
						generatedFilename =
							typeof filename === 'function' ? (filename as Function)(file, extension) : filename;
					} else {
						generatedFilename = generateUniqueFilename(prefix, extension);
					}

					callback(null, generatedFilename);
				}
			});
		} catch (error) {
			this._log('error', 'Error creating Multer handler:', error);
			return null;
		}
	}

	/**
	 * Reads the content of the file asynchronously and returns a Promise resolving to a Buffer.
	 *
	 * @param file - The file path.
	 * @returns A Promise resolving to a Buffer containing the file data.
	 */
	public async getFile(file: string): Promise<Buffer | null> {
		try {
			const fullPath = this.path(file);
			if (!fullPath) {
				return null;
			}
			return await fs.promises.readFile(fullPath);
		} catch (error) {
			this._log('error', `Error reading file "${file}":`, error);
			return null;
		}
	}

	/**
	 * Writes the file content to the specified path asynchronously and returns a Promise resolving to an UploadedFile.
	 *
	 * @param fileContent - The content of the file.
	 * @param path - The path where the file will be stored.
	 * @returns A Promise resolving to an UploadedFile.
	 */
	public async putFile(fileContent: string | Buffer | URL, filePath: string = ''): Promise<UploadedFile | null> {
		try {
			this._refreshConfig();

			const fullPath = join(this.config.rootPath || DEFAULT_ROOT_PATH, filePath);

			// Ensure directory exists
			const dir =
				fullPath.substring(0, fullPath.lastIndexOf('/')) || fullPath.substring(0, fullPath.lastIndexOf('\\'));
			if (dir) {
				fs.mkdirSync(dir, { recursive: true });
			}

			await fs.promises.writeFile(fullPath, fileContent as any);

			const stats = await fs.promises.stat(fullPath);
			const baseName = basename(filePath);

			const file: Partial<UploadedFile> = {
				originalname: baseName,
				size: stats.size,
				filename: baseName,
				path: fullPath,
				key: normalizeFilePath(filePath)
			};

			return await this.mapUploadedFile(file);
		} catch (error) {
			this._log('error', `Error putting file at path "${filePath}":`, error);
			throw new HttpException({ message: `Failed to put file: ${filePath}`, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Deletes the file asynchronously.
	 *
	 * @param file - The file path.
	 * @returns A Promise that resolves when the file is deleted successfully.
	 */
	public async deleteFile(file: string): Promise<void> {
		try {
			const filePath = this.path(file);

			if (filePath && fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
				this._log('info', `File "${file}" deleted successfully`);
			}
		} catch (error) {
			this._log('error', `Error deleting file "${file}":`, error);
			throw error;
		}
	}

	/**
	 * Check if a file exists in local storage.
	 *
	 * @param key - The file key/path
	 * @returns True if the file exists
	 */
	public async fileExists(key: string): Promise<boolean> {
		try {
			const fullPath = this.path(key);
			if (!fullPath) {
				return false;
			}
			await fs.promises.access(fullPath, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the configured root path.
	 *
	 * @returns The root path or default if not configured
	 */
	public getRootPath(): string {
		this._refreshConfig();
		return this.config.rootPath || DEFAULT_ROOT_PATH;
	}

	/**
	 * Map uploaded file to include URL.
	 * Required by core Provider interface.
	 *
	 * @param file - The uploaded file information
	 * @returns Mapped file with URL
	 */
	public async mapUploadedFile(file: Partial<UploadedFile>): Promise<UploadedFile> {
		this._refreshConfig();

		const separator = process.platform === 'win32' ? '\\' : '/';

		if (file.path) {
			const rootPath = this.config.rootPath || DEFAULT_ROOT_PATH;
			file.key = normalizeFilePath(file.path.replace(`${rootPath}${separator}`, ''));
		}

		if (file.key) {
			file.url = await this.url(file.key);
		}

		return file as UploadedFile;
	}

	// ==================== Private Methods ====================

	/**
	 * Create an empty configuration object matching FileSystem & ILocalFileStorageProviderConfig
	 */
	private _createEmptyConfig(): FileSystem & ILocalFileStorageProviderConfig {
		return {
			rootPath: DEFAULT_ROOT_PATH,
			local_base_url: DEFAULT_BASE_URL,
			local_public_path: DEFAULT_PUBLIC_PATH
		};
	}

	/**
	 * Refresh configuration from provider or static config.
	 */
	private _refreshConfig(): void {
		// Priority: configProvider > staticConfig > empty
		let rawConfig: ILocalConfig | null = null;

		if (this._configProvider) {
			rawConfig = this._configProvider.getConfig();
		} else if (this._staticConfig) {
			rawConfig = this._staticConfig;
		}

		if (rawConfig) {
			// Map to FileSystem & ILocalFileStorageProviderConfig format for core compatibility
			this.config = {
				rootPath: rawConfig.rootPath ?? DEFAULT_ROOT_PATH,
				local_base_url: rawConfig.baseUrl ?? DEFAULT_BASE_URL,
				local_public_path: rawConfig.publicPath ?? DEFAULT_PUBLIC_PATH
			};
		}

		if (this._detailedLoggingEnabled) {
			this._log('debug', 'Configuration refreshed:', this.config);
		}
	}

	/**
	 * Log a message with the specified level.
	 */
	private _log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
		if (!this._detailedLoggingEnabled && level === 'debug') {
			return;
		}

		const prefix = `[LocalProvider]`;
		switch (level) {
			case 'debug':
			case 'info':
				console.log(prefix, message, ...args);
				break;
			case 'warn':
				console.warn(prefix, message, ...args);
				break;
			case 'error':
				console.error(prefix, message, ...args);
				break;
		}
	}
}
