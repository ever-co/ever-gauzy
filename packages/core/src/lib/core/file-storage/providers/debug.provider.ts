import * as multer from 'multer';
import { join, resolve } from 'path';
import { FileStorageOption, UploadedFile } from '@gauzy/contracts';
import { environment, getConfig } from '@gauzy/config';
import { getApiPublicPath } from '../../util/path-util';
import { Provider } from './provider';

export class DebugProvider extends Provider<DebugProvider> {
	public readonly name = 'DEBUG';
	public instance: DebugProvider;
	public config: { rootPath: string; baseUrl: string };

	constructor() {
		super();
		void this.initConfig();
	}

	/**
	 * Initializes the configuration asynchronously.
	 */
	private async initConfig(): Promise<void> {
		const config = getConfig(); // Fetch the config inside an async function
		const apiPublicPath = getApiPublicPath(); // Get the public path for the API

		this.config = {
			rootPath:
				(environment.isElectron
					? resolve(environment.gauzyUserPath, 'public')
					: config.assetOptions?.assetPublicPath) || apiPublicPath,
			baseUrl: environment.baseUrl
		};
	}

	/**
	 * Get the singleton instance of LocalProvider
	 * @returns {LocalProvider} The singleton instance
	 */
	getProviderInstance(): DebugProvider {
		if (!this.instance) {
			this.instance = new DebugProvider();
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
	handler(options: FileStorageOption): multer.StorageEngine {
		return null;
	}

	/**
	 * Reads the content of the file asynchronously and returns a Promise resolving to a Buffer.
	 *
	 * @param file - The file path.
	 * @returns A Promise resolving to a Buffer containing the file data.
	 */
	async getFile(file: string): Promise<Buffer | any> {
		return null;
	}

	/**
	 * Writes the file content to the specified path asynchronously and returns a Promise resolving to an UploadedFile.
	 *
	 * @param fileContent - The content of the file.
	 * @param path - The path where the file will be stored.
	 * @returns A Promise resolving to an UploadedFile.
	 */
	async putFile(fileContent: any, path: string = ''): Promise<UploadedFile> {
		return null;
	}

	/**
	 * Deletes the file asynchronously.
	 *
	 * @param file - The file path.
	 * @returns A Promise that resolves when the file is deleted successfully.
	 */
	async deleteFile(file: string): Promise<void> {
		return null;
	}

	/**
	 * Map a partial UploadedFile object to include filename and URL.
	 *
	 * @param file - The partial UploadedFile object to map
	 * @returns The mapped file object
	 */
	public async mapUploadedFile(file: any): Promise<UploadedFile> {
		return null;
	}
}
