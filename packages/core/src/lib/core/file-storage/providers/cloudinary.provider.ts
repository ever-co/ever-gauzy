import { Request } from 'express';
import * as multer from 'multer';
import * as moment from 'moment';
import { join } from 'path';
import { URL } from 'url';
import * as streamifier from 'streamifier';
import axios from 'axios';
import { ConfigOptions, UploadApiErrorResponse, UploadApiResponse, v2 as cloudinaryV2 } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { environment } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from '@gauzy/contracts';
import { ICloudinaryConfig, isNotEmpty, trimAndGetValue } from '@gauzy/common';
import { Provider } from './provider';
import { RequestContext } from './../../../core/context';

// Retrieve Cloudinary configuration from the environment
const { cloudinary } = environment;

export class CloudinaryProvider extends Provider<CloudinaryProvider> {
	public instance: CloudinaryProvider;
	public readonly name = FileStorageProviderEnum.CLOUDINARY;
	public config: ICloudinaryConfig & FileSystem;

	private readonly _detailedLoggingEnabled= false;

	constructor() {
		super();
		this.setDefaultConfiguration();
	}

	/**
	 * Get the singleton instance of CloudinaryProvider
	 * @returns {CloudinaryProvider} The singleton instance
	 */
	getProviderInstance(): CloudinaryProvider {
		if (!this.instance) {
			this.instance = new CloudinaryProvider();
		}
		this.setCloudinaryConfiguration();
		return this.instance;
	}

	/**
	 * Retrieves and configures a Cloudinary instance based on the provided configuration.
	 * The configuration includes cloud_name, api_key, api_secret, and secure settings.
	 *
	 * @returns ConfigOptions | undefined - The Cloudinary configuration object or undefined in case of an error.
	 */
	private getCloudinaryInstance(): ConfigOptions | undefined {
		try {
			// Set the Cloudinary configuration based on the current instance's settings
			this.setCloudinaryConfiguration();

			if (this.config.cloud_name && this.config.api_key && this.config.api_secret) {
				// Use cloudinary.config to set the Cloudinary configuration
				return cloudinaryV2.config({
					cloud_name: this.config.cloud_name,
					api_key: this.config.api_key,
					api_secret: this.config.api_secret,
					secure: this.config.secure
				});
			} else {
				// Log a warning if any of the required Cloudinary settings are missing
				console.warn(`Missing Cloudinary settings: ${JSON.stringify(this.config)}`);
			}
		} catch (error) {
			// Log any errors that occur during the process
			console.error(`Error while retrieving ${FileStorageProviderEnum.CLOUDINARY} instance:`, error);
		}
	}

	/**
	 * Sets default Cloudinary configuration values based on environment settings.
	 * This function initializes the configuration object with values such as rootPath, baseUrl,
	 * cloud_name, api_key, api_secret, and secure, using the provided environment configuration.
	 */
	setDefaultConfiguration(): void {
		// Set default values for the Cloudinary configuration object
		this.config = {
			rootPath: '',
			baseUrl: cloudinary.delivery_url,
			cloud_name: cloudinary.cloud_name,
			api_key: cloudinary.api_key,
			api_secret: cloudinary.api_secret,
			secure: cloudinary.secure
		};
	}

	/**
	 * Sets Cloudinary configuration by updating the existing configuration with values from the current request's tenant settings.
	 * The function uses default values and trims/validates the obtained settings before updating the configuration.
	 */
	setCloudinaryConfiguration(): void {
		// Use the default configuration as a starting point
		this.config = {
			rootPath: '',
			...this.config
		};

		try {
			const request = RequestContext.currentRequest();

			if (request) {
				const settings = request['tenantSettings'];

				if (settings) {
					if (this._detailedLoggingEnabled)
						console.log(`setWasabiConfiguration Tenant Settings value: ${JSON.stringify(settings)}`);

					if (trimAndGetValue(settings.cloudinary_cloud_name))
						this.config.cloud_name = trimAndGetValue(settings.cloudinary_cloud_name);

					if (trimAndGetValue(settings.cloudinary_api_key))
						this.config.api_key = trimAndGetValue(settings.cloudinary_api_key);

					if (trimAndGetValue(settings.cloudinary_api_secret))
						this.config.api_secret = trimAndGetValue(settings.cloudinary_api_secret);

					if (isNotEmpty(settings.cloudinary_api_secure)) {
						if (settings.cloudinary_api_secure == 'true') this.config.secure = true;
						else if (settings.cloudinary_api_secure == 'false') this.config.secure = false;
					}

					if (isNotEmpty(settings.cloudinary_delivery_url))
						this.config.baseUrl = new URL(settings.cloudinary_delivery_url).toString();
				}
			}
		} catch (error) {
			console.error('Error while setting Wasabi configuration. Default configuration will be used', error);
		}
	}

	/**
	 * Multer storage engine handler for Cloudinary.
	 *
	 * @param options - File storage options, including destination, filename, and prefix
	 * @returns multer.StorageEngine - Configured Cloudinary storage engine
	 */
	handler(options: FileStorageOption): multer.StorageEngine {
		const { dest, filename, prefix = 'file' } = options;

		try {
			/** Get cloudinary instance */
			this.getCloudinaryInstance();

			return new CloudinaryStorage({
				cloudinary: cloudinaryV2,
				params: (_req: Request, file: Express.Multer.File) => {
					// Extract file format from original name
					const format = file.originalname.split('.').pop();

					// Determine destination path (string or function)
					const destination = dest instanceof Function ? dest(file) : dest;

					// Convert destination to folder format and replace backslashes with forward slashes
					const folder = join(destination).replace(/\\/g, '/');

					// Determine the public_id (name) of the uploaded file
					let public_id: string;
					if (filename) {
						public_id = typeof filename === 'string' ? filename : filename(file, format);
					} else {
						public_id = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}`;
					}

					// Return Cloudinary parameters
					return {
						public_id,
						folder,
						format
					};
				}
			});
		} catch (error) {
			console.error(`Error while creating ${FileStorageProviderEnum.CLOUDINARY} storage engine:`, error);
			return null;
		}
	}

	/**
	 * Generates a complete URL for a file based on the provided file URL.
	 *
	 * @param fileURL - The file URL to generate a complete URL for
	 * @returns Promise<string | null> - A promise resolving to the complete URL or null if input is invalid
	 */
	public async url(fileURL: string): Promise<string | null> {
		// If fileURL is null or starts with 'http', assume it's already a complete URL
		if (!fileURL || fileURL.startsWith('http')) {
			return fileURL;
		}

		// Construct a new URL using the Cloudinary configuration
		return new URL(join(this.config.cloud_name, fileURL), this.config.baseUrl).toString();
	}

	/**
	 * Generates a complete path or URL for a file based on the provided file path.
	 *
	 * @param filePath - The file path to generate a complete path or URL for
	 * @returns string | null - The complete path or URL, or null if the input is invalid
	 */
	public path(filePath: string): string | null {
		if (!filePath) {
			return null;
		}

		// If filePath starts with 'http', assume it's already a complete URL
		if (filePath.startsWith('http')) {
			return filePath;
		}

		try {
			// Attempt to construct a new URL using the Cloudinary configuration
			return new URL(join(this.config.cloud_name, filePath), this.config.baseUrl).toString();
		} catch (error) {
			console.error(`Error constructing URL for file path: ${filePath}`, error);
			return null;
		}
	}

	/**
	 * Retrieves a file from Cloudinary and returns it as a Buffer.
	 *
	 * @param file - The file identifier
	 * @returns Promise<Buffer | any> - A promise resolving to the file content as a Buffer, or any if an error occurs
	 */
	async getFile(file: string): Promise<Buffer | any> {
		try {
			// Get the complete URL for the file
			const URL = await this.url(file);

			// Fetch the file content from Cloudinary using axios
			const response = await axios.get(URL, { responseType: 'arraybuffer' });

			// Convert the response data to a Buffer
			const fileBuffer = Buffer.from(response.data, 'utf-8');

			return fileBuffer;
		} catch (error) {
			console.error('Error while retrieving Cloudinary image from server', error);
			// Return any value to indicate an error occurred
			return null;
		}
	}

	/**
	 * Uploads a file to Cloudinary and returns information about the uploaded file.
	 *
	 * @param file - The file to be uploaded
	 * @param path - The destination path for the uploaded file (default: '')
	 * @returns Promise<UploadedFile> - A promise resolving to information about the uploaded file
	 */
	async putFile(file: any, path: string = ''): Promise<UploadedFile> {
		return new Promise((resolve, reject) => {
			// A string or function that determines the destination image path for uploaded.
			const public_id = join(path).replace(/\\/g, '/');

			// Create an upload stream to Cloudinary
			const stream = cloudinaryV2.uploader.upload_stream(
				{ public_id },
				(error: UploadApiErrorResponse, result: UploadApiResponse) => {
					if (error) {
						// Reject the promise with the error if the upload fails
						reject(error);
					} else {
						// Resolve the promise with information about the uploaded file
						const uploadedFile = {
							key: result.public_id,
							size: result.bytes,
							filename: result.public_id,
							url: result.url,
							path: result.secure_url
						};
						resolve(uploadedFile as any);
					}
				}
			);

			// Pipe the file content to the upload stream
			streamifier.createReadStream(file).pipe(stream);
		});
	}

	/**
	 * Deletes a file from Cloudinary.
	 *
	 * @param file - The identifier of the file to delete
	 * @returns Promise<void> - A promise indicating the success or failure of the deletion operation
	 */
	async deleteFile(file: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// Use the Cloudinary v2 SDK for better compatibility and features
			cloudinaryV2.uploader.destroy(file, (error: any, result: any) => {
				if (error) {
					// Reject the promise with the error if deletion fails
					reject(error);
				} else {
					// Resolve the promise if deletion is successful
					resolve(result);
				}
			});
		});
	}

	/**
	 * Map uploaded file for cloudinary provider
	 *
	 * @param file
	 * @returns
	 */
	public async mapUploadedFile(file: any): Promise<UploadedFile> {
		if (isNotEmpty(file.filename)) {
			const filename = file.filename;
			file.key = filename;

			const originalname = filename.split('/').pop();
			file.filename = originalname;
		}

		return file;
	}
}
