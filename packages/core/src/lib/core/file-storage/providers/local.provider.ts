import { HttpException, HttpStatus } from '@nestjs/common';
import * as multer from 'multer';
import * as fs from 'fs';
import { basename, join, resolve } from 'path';
import * as moment from 'moment';
import { FileStorageOption, FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { environment, getConfig } from '@gauzy/config';
import { Provider } from './provider';
import { getApiPublicPath } from '../../util/path-util';

// Get the application configuration
const config = getConfig();

// Get the public path for the API
const apiPublicPath = getApiPublicPath();
console.log(`API Public Path: ${apiPublicPath}`);

/**
 * Local file storage provider
 */
export class LocalProvider extends Provider<LocalProvider> {
	public instance: LocalProvider;
	public readonly name = FileStorageProviderEnum.LOCAL;
	public config = {
		rootPath:
			(environment.isElectron
				? resolve(environment.gauzyUserPath, 'public')
				: config.assetOptions.assetPublicPath) || apiPublicPath,
		baseUrl: environment.baseUrl
	};

	/**
	 * Get the singleton instance of LocalProvider
	 * @returns {LocalProvider} The singleton instance
	 */
	getProviderInstance(): LocalProvider {
		if (!this.instance) {
			this.instance = new LocalProvider();
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
		const { dest, filename, prefix = 'file' } = options;

		try {
			return multer.diskStorage({
				destination: (_req, file, callback) => {
					// A string or function that determines the destination path for uploaded
					const dir = dest instanceof Function ? dest(file) : dest;

					// Ensure the destination directory exists, create if not
					const fullPath = join(this.config.rootPath, dir);
					fs.mkdirSync(fullPath, { recursive: true });

					callback(null, fullPath);
				},
				filename: (_req, file, callback) => {
					// A file extension, or filename extension, is a suffix at the end of a file
					const extension = file.originalname.split('.').pop();

					/**
					 * A function that determines the name of the uploaded file.
					 * Simplified and optimized filename assignment
					 */
					let fileName: string = filename
						? typeof filename === 'string'
							? filename
							: filename(file, extension)
						: `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}.${extension}`;

					callback(null, fileName);
				}
			});
		} catch (error) {
			console.error(`Error while creating multer disk storage:`, error);
			return null;
		}
	}

	/**
	 * Reads the content of the file asynchronously and returns a Promise resolving to a Buffer.
	 *
	 * @param file - The file path.
	 * @returns A Promise resolving to a Buffer containing the file data.
	 */
	async getFile(file: string): Promise<Buffer | any> {
		try {
			return await fs.promises.readFile(this.path(file));
		} catch (error) {
			console.error(`Error while reading file "${file}":`, error);
		}
	}

	/**
	 * Writes the file content to the specified path asynchronously and returns a Promise resolving to an UploadedFile.
	 *
	 * @param fileContent - The content of the file.
	 * @param path - The path where the file will be stored.
	 * @returns A Promise resolving to an UploadedFile.
	 */
	async putFile(fileContent: any, path: string = ''): Promise<UploadedFile> {
		try {
			const fullPath = join(this.config.rootPath, path);
			await fs.promises.writeFile(fullPath, fileContent);

			const stats = await fs.promises.stat(fullPath);
			const baseName = basename(path);

			const file: Partial<UploadedFile> = {
				originalname: baseName, // original file name
				size: stats.size, // files in bytes
				filename: baseName,
				path: fullPath // Full path of the file
			};

			return await this.mapUploadedFile(file);
		} catch (error) {
			console.error(`Error while putting file at path "${path}":`, error);
			throw new HttpException(error, HttpStatus.BAD_REQUEST, {
				description: `Error while putting file at path "${path}":`
			});
		}
	}

	/**
	 * Deletes the file asynchronously.
	 *
	 * @param file - The file path.
	 * @returns A Promise that resolves when the file is deleted successfully.
	 */
	async deleteFile(file: string): Promise<void> {
		try {
			const filePath = this.path(file);

			// Check if the file exists before attempting to delete
			if (fs.existsSync(filePath)) {
				return fs.unlinkSync(filePath);
			}
		} catch (error) {
			console.error(`Error while deleting file "${file}":`, error);
			throw error; // Rethrow the error to let the calling code handle it
		}
	}

	/**
	 * Map a partial UploadedFile object to include filename and URL.
	 *
	 * @param file - The partial UploadedFile object to map
	 * @returns The mapped file object
	 */
	public async mapUploadedFile(file: any): Promise<UploadedFile> {
		const separator = process.platform === 'win32' ? '\\' : '/';

		if (file.path) {
			file.key = file.path.replace(`${this.config.rootPath}${separator}`, '');
		}

		file.url = await this.url(file.key);
		return file;
	}
}
