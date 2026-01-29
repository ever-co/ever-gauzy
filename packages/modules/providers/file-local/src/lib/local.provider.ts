import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import * as multer from 'multer';
import * as fs from 'fs';
import { basename, join } from 'path';
import { StorageEngine } from 'multer';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from '@gauzy/contracts';
import { Provider } from './provider';
import { ILocalConfig, ILocalConfigProvider } from './interfaces';
import { LOCAL_CONFIG, LOCAL_CONFIG_PROVIDER } from './constants';

/**
 * Generate a unique filename with timestamp and random suffix.
 */
function generateUniqueFilename(prefix: string, extension: string): string {
	console.log('Generate unique filename', prefix, extension);

	const timestamp = Math.floor(Date.now() / 1000);
	const randomSuffix = Math.floor(Math.random() * 1000);
	return `${prefix}-${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Normalize a file path by replacing backslashes with forward slashes.
 */
function normalizeFilePath(filePath: string): string {
	console.log('Normalize file path', filePath);
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
 * - Static configuration initialized once during construction
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
	 * Current configuration
	 */
	public config: ILocalConfig;

	constructor(
		@Optional() @Inject(LOCAL_CONFIG) staticConfig?: ILocalConfig,
		@Optional() @Inject(LOCAL_CONFIG_PROVIDER) configProvider?: ILocalConfigProvider
	) {
		super();

		// Initialize config from provider or static config
		const rawConfig = configProvider?.getConfig() ?? staticConfig;
		this.applyConfig(rawConfig);
	}

	/**
	 * Normalize and apply configuration.
	 * Handles undefined config for standalone usage (new LocalProvider() without DI).
	 */
	private applyConfig(config?: ILocalConfig | null): void {
		this.config = {
			rootPath: config?.rootPath ?? 'public',
			baseUrl: config?.baseUrl ?? '',
			publicPath: config?.publicPath ?? 'public'
		};
	}

	/**
	 * Set static configuration directly.
	 * Use this for standalone usage without dependency injection.
	 *
	 * @param config - The Local storage configuration
	 */
	public setConfig(config: ILocalConfig): void {
		this.applyConfig(config);
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
		return this.instance;
	}

	/**
	 * Generates a URL for a given file URL.
	 * If the file URL is already an external URL (starts with 'http'), returns the original URL.
	 * If the file URL is relative, constructs a URL using the 'public' directory and the base URL from the configuration.
	 *
	 * @param fileURL - The file URL for which to generate a URL.
	 * @returns A Promise resolving to a string representing the generated URL.
	 */
	public async url(fileURL: string): Promise<string> {
		// If the file URL is already an external URL, return the original URL
		if (!fileURL || fileURL.startsWith('http')) {
			return fileURL;
		}

		// If the file URL is relative, construct a URL using the 'public' directory and the base URL from the configuration
		return new URL(join('public', fileURL), this.config.baseUrl).toString();
	}

	/**
	 * Gets the full path of the file storage by joining the root path with the provided file path.
	 *
	 * @param filePath - The file path for which to get the full path.
	 * @returns The full path of the file storage or null if the file path is falsy.
	 */
	public path(filePath: string): string | null {
		// If the file path is truthy, join it with the root path; otherwise, return null
		return filePath ? join(this.config.rootPath, filePath) : null;
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
			return multer.diskStorage({
				destination: (_req, file, callback) => {
					// A string or function that determines the destination path for uploaded files
					const dir = typeof dest === 'function' ? (dest as Function)(file) : dest;

					// Ensure the destination directory exists, create if not
					const fullPath = join(this.config.rootPath || 'public', dir);
					fs.mkdirSync(fullPath, { recursive: true });

					callback(null, fullPath);
				},
				filename: (_req, file, callback) => {
					// A file extension, or filename extension, is a suffix at the end of a file
					const extension = file.originalname.split('.').pop();
					console.log('Extension', extension);

					// Generate filename
					let fileName: string;

					if (filename) {
						fileName = typeof fileName === 'function' ? (filename as Function)(file, extension) : filename;
					} else {
						fileName = generateUniqueFilename(prefix, extension);
					}

					callback(null, fileName);
				}
			});
		} catch (error) {
			console.error('Error creating Multer handler:', error);
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
			console.error(`Error reading file "${file}":`, error);
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
			const fullPath = join(this.config.rootPath || 'public', filePath);
			console.log('Full file path', fullPath);

			await fs.promises.writeFile(fullPath, fileContent as Buffer);

			const stats = await fs.promises.stat(fullPath);
			const baseName = basename(filePath);

			const file: Partial<UploadedFile> = {
				originalname: baseName,
				size: stats.size,
				filename: baseName,
				path: fullPath,
				key: normalizeFilePath(filePath)
			};

			console.log('Before Uploaded File', file);
			return await this.mapUploadedFile(file);
		} catch (error) {
			console.error(`Error putting file at path "${filePath}":`, error);
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
				console.log(`File "${file}" deleted successfully`);
			}
		} catch (error) {
			console.error(`Error deleting file "${file}":`, error);
			throw error;
		}
	}

	/**
	 * Check if a file exists in local storage.
	 *
	 * @param key - The file key/path
	 * @returns True if the file exists and is a file (not a directory)
	 */
	public async fileExists(key: string): Promise<boolean> {
		// Early return for invalid input
		if (!key) {
			return false;
		}

		const fullPath = this.path(key);
		if (!fullPath) {
			return false;
		}

		try {
			const stats = await fs.promises.stat(fullPath);
			// Ensure it's actually a file, not a directory
			return stats.isFile();
		} catch (error: any) {
			// ENOENT means file doesn't exist - this is expected, not an error
			if (error.code === 'ENOENT') {
				return false;
			}
			// Log unexpected errors (permission issues, etc.)
			console.error(`Error checking file existence for "${key}":`, error.message);
			return false;
		}
	}

	/**
	 * Get the configured root path.
	 *
	 * @returns The root path or default if not configured
	 */
	public getRootPath(): string {
		return this.config.rootPath || 'public';
	}

	/**
	 * Map uploaded file to include URL.
	 * Required by core Provider interface.
	 *
	 * @param file - The uploaded file information
	 * @returns Mapped file with URL
	 */
	public async mapUploadedFile(file: Partial<UploadedFile>): Promise<UploadedFile> {
		const separator = process.platform === 'win32' ? '\\' : '/';

		if (file.path) {
			const rootPath = this.config.rootPath || 'public';
			file.key = normalizeFilePath(file.path.replace(`${rootPath}${separator}`, ''));
		}

		if (file.key) {
			file.url = await this.url(file.key);
		}

		return file as UploadedFile;
	}
}
