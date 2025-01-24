import { HttpException, HttpStatus } from '@nestjs/common';
import * as multerS3 from 'multer-s3';
import { basename, join } from 'path';
import * as moment from 'moment';
import {
	S3Client,
	DeleteObjectCommand,
	DeleteObjectCommandOutput,
	GetObjectCommand,
	GetObjectCommandOutput,
	PutObjectCommand,
	HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageEngine } from 'multer';
import { environment } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { ensureHttpPrefix, trimIfNotEmpty } from '@gauzy/utils';
import { Provider } from './provider';
import { RequestContext } from '../../context';

/**
 * Digital Ocean Configuration
 */
const { digitalOcean } = environment;

/**
 * Configuration interface for DigitalOcean storage.
 */
export interface IDigitalOceanProviderConfig {
	rootPath: string; // Root path for DigitalOcean storage
	digitalocean_access_key_id: string; // AWS access key ID for DigitalOcean
	digitalocean_secret_access_key: string; // AWS secret access key for DigitalOcean
	digitalocean_default_region: string; // AWS default region for DigitalOcean
	digitalocean_service_url: string; // AWS service URL for DigitalOcean
	digitalocean_cdn_url: string; // AWS service CDN  for DigitalOcean
	digitalocean_s3_bucket: string; // AWS bucket name for DigitalOcean
	digitalocean_s3_force_path_style: boolean; // Whether to force path style URLs for DigitalOcean objects
}

export class DigitalOceanS3Provider extends Provider<DigitalOceanS3Provider> {
	public readonly name = FileStorageProviderEnum.DIGITALOCEAN;
	private readonly detailedLoggingEnabled = false;
	public instance: DigitalOceanS3Provider;
	public config: IDigitalOceanProviderConfig;
	public defaultConfig: IDigitalOceanProviderConfig;

	constructor() {
		super();
		void this.initConfig();
	}

	/**
	 * Initializes the configuration asynchronously.
	 */
	private async initConfig(): Promise<void> {
		this.defaultConfig = {
			rootPath: '',
			digitalocean_access_key_id: digitalOcean?.accessKeyId ?? '',
			digitalocean_secret_access_key: digitalOcean?.secretAccessKey ?? '',
			digitalocean_default_region: digitalOcean?.region ?? 'us-east-1',
			digitalocean_service_url: digitalOcean?.serviceUrl ?? '',
			digitalocean_cdn_url: digitalOcean?.cdnUrl ?? '',
			digitalocean_s3_bucket: digitalOcean?.s3?.bucket ?? '',
			digitalocean_s3_force_path_style: digitalOcean?.s3?.forcePathStyle ?? false
		};

		// Assign the initialized config
		this.config = { ...this.defaultConfig };
	}

	/**
	 * Get the singleton instance of DigitalOceanS3Provider
	 *
	 * @returns {DigitalOceanS3Provider} The singleton instance
	 */
	getProviderInstance(): DigitalOceanS3Provider {
		if (!this.instance) {
			this.instance = new DigitalOceanS3Provider();
		}

		this.setDigitalOceanConfiguration();
		return this.instance;
	}

	/**
	 * Set DigitalOcean details based on the current request's tenantSettings.
	 * If such settings does not have any DigitalOcean details, use the default configuration.
	 * If they have DigitalOcean details, use them to override the default configuration.
	 */
	private setDigitalOceanConfiguration() {
		// Use the default configuration as a starting point
		this.config = {
			...this.defaultConfig
		};

		if (this.detailedLoggingEnabled) {
			console.log(`setDigitalOceanConfiguration this config value: ${JSON.stringify(this.config)}`);
		}

		try {
			const request = RequestContext.currentRequest();
			if (request) {
				const settings = request['tenantSettings'];

				if (settings) {
					if (this.detailedLoggingEnabled) {
						console.log(`setDigitalOceanConfiguration Tenant Settings Value: ${JSON.stringify(settings)}`);
					}

					if (trimIfNotEmpty(settings.digitalocean_access_key_id)) {
						this.config.digitalocean_access_key_id = trimIfNotEmpty(settings.digitalocean_access_key_id);

						if (this.detailedLoggingEnabled) {
							console.log(
								`setDigitalOceanConfiguration this.config.digitalocean_access_key_id value: ${this.config.digitalocean_access_key_id}`
							);
						}
					}

					if (trimIfNotEmpty(settings.digitalocean_secret_access_key)) {
						this.config.digitalocean_secret_access_key = trimIfNotEmpty(
							settings.digitalocean_secret_access_key
						);

						if (this.detailedLoggingEnabled) {
							console.log(
								`setDigitalOceanConfiguration this.config.digitalocean_secret_access_key value: ${this.config.digitalocean_secret_access_key}`
							);
						}
					}

					if (trimIfNotEmpty(settings.digitalocean_service_url)) {
						this.config.digitalocean_service_url = ensureHttpPrefix(
							trimIfNotEmpty(settings.digitalocean_service_url)
						);

						if (this.detailedLoggingEnabled) {
							console.log(
								'setDigitalOceanConfiguration this.config.digitalocean_service_url value: ',
								this.config.digitalocean_service_url
							);
						}
					}

					if (trimIfNotEmpty(settings.digitalocean_default_region)) {
						this.config.digitalocean_default_region = trimIfNotEmpty(settings.digitalocean_default_region);

						if (this.detailedLoggingEnabled) {
							console.log(
								'setDigitalOceanConfiguration this.config.digitalocean_default_region value: ',
								this.config.digitalocean_default_region
							);
						}
					}

					if (trimIfNotEmpty(settings.digitalocean_s3_bucket)) {
						this.config.digitalocean_s3_bucket = trimIfNotEmpty(settings.digitalocean_s3_bucket);

						if (this.detailedLoggingEnabled) {
							console.log(
								'setDigitalOceanConfiguration this.config.digitalocean_s3_bucket value: ',
								this.config.digitalocean_s3_bucket
							);
						}
					}

					// Assuming trimIfNotEmpty() function trims and retrieves the value from settings
					const forcePathStyle = trimIfNotEmpty(settings.digitalocean_s3_force_path_style);
					this.config.digitalocean_s3_force_path_style = forcePathStyle === 'true' || forcePathStyle === '1';

					if (this.detailedLoggingEnabled) {
						console.log(
							'setDigitalOceanConfiguration this.config.digitalocean_s3_force_path_style value: ',
							this.config.digitalocean_s3_force_path_style
						);
					}
				}
			}
		} catch (error) {
			console.error('Error while setting DigitalOcean configuration. Default configuration will be used', error);
		}
	}

	/**
	 * Get a pre-signed URL for a given file URL.
	 *
	 * @param fileURL - The file URL for which to generate a pre-signed URL
	 * @returns Pre-signed URL or null if the input is invalid
	 */
	public async url(fileURL: string): Promise<string | null> {
		if (!fileURL || fileURL.startsWith('http')) {
			return fileURL;
		}

		try {
			const s3Client = this.getDigitalOceanInstance();

			if (s3Client) {
				const signedUrl = await getSignedUrl(
					s3Client,
					new GetObjectCommand({
						Bucket: this.getDigitalOceanBucket(),
						Key: fileURL
					}),
					{
						expiresIn: 3600
					}
				);

				return signedUrl;
			} else {
				console.error('Error while retrieving signed URL: s3Client is null');
				return null;
			}
		} catch (error) {
			console.error('Error while retrieving signed URL:', error);
			return null;
		}
	}

	/**
	 * Get the full path of the file in the storage.
	 *
	 * @param filePath - The file path to join with the root path
	 * @returns Full path or null if filePath is falsy
	 */
	public path(filePath: string): string | null {
		return filePath ? join(this.config.rootPath, filePath) : null;
	}

	/**
	 * Create a Multer storage engine configured for AWS S3 (DigitalOcean).
	 *
	 * @param options - Configuration options for the storage engine
	 * @returns A Multer storage engine
	 */
	public handler(options: FileStorageOption): StorageEngine {
		const { dest, filename, prefix = 'file' } = options;

		try {
			const s3Client = this.getDigitalOceanInstance();

			if (s3Client) {
				return multerS3({
					s3: s3Client,
					bucket: (_req, _file, callback) => {
						callback(null, this.getDigitalOceanBucket());
					},
					metadata: function (_req, _file, callback) {
						callback(null, { fieldName: _file.fieldname });
					},
					key: (_req, file, callback) => {
						// A string or function that determines the destination path for uploaded
						const destination = dest instanceof Function ? dest(file) : dest;

						// A file extension, or filename extension, is a suffix at the end of a file.
						const extension = file.originalname.split('.').pop();

						// A function that determines the name of the uploaded file.
						let fileName: string;

						if (filename) {
							fileName = typeof filename === 'string' ? filename : filename(file, extension);
						} else {
							fileName = `${prefix}-${moment().unix()}-${parseInt(
								'' + Math.random() * 1000,
								10
							)}.${extension}`;
						}

						// Replace double backslashes with single forward slashes
						const fullPath = join(destination, fileName).replace(/\\/g, '/');

						callback(null, fullPath);
					}
				});
			} else {
				console.error('Error while retrieving Multer for DigitalOcean: s3Client is null');
				return null;
			}
		} catch (error) {
			console.error('Error while retrieving Multer for DigitalOcean:', error);
			return null;
		}
	}

	/**
	 * Get a file from DigitalOcean storage.
	 *
	 * @param key - The key of the file to retrieve
	 * @returns A Promise resolving to a Buffer containing the file data
	 */
	async getFile(key: string): Promise<Buffer | any> {
		try {
			const s3Client = this.getDigitalOceanInstance();

			if (s3Client) {
				// Input parameters when using the GetObjectCommand to retrieve an object from DigitalOcean storage.
				const command = new GetObjectCommand({
					Bucket: this.getDigitalOceanBucket(), // The name of the bucket from which to retrieve the object.
					Key: key // The key (path) of the object to retrieve from the bucket.
				});

				/**
				 * Send a GetObjectCommand to DigitalOcean to retrieve an object
				 */
				const data: GetObjectCommandOutput = await s3Client.send(command);
				return data.Body;
			} else {
				console.error('Error while retrieving signed URL: s3Client is null');
			}
		} catch (error) {
			console.error(`Error while fetching file with key '${key}':`, error);
		}
	}

	/**
	 * Upload a file to DigitalOcean storage.
	 *
	 * @param fileContent - The content of the file to upload
	 * @param key - The key under which to store the file
	 * @returns A Promise resolving to an UploadedFile, or undefined on error
	 */
	async putFile(fileContent: string, key: string = ''): Promise<UploadedFile> {
		try {
			// Replace double backslashes with single forward slashes
			key = key.replace(/\\/g, '/');

			const s3Client = this.getDigitalOceanInstance();

			if (s3Client) {
				const filename = basename(key);

				// Input parameters for the PutObjectCommand when uploading a file to DigitalOcean storage.
				const putObjectCommand = new PutObjectCommand({
					Bucket: this.getDigitalOceanBucket(), // The name of the bucket to which the file should be uploaded.
					Body: fileContent, // The content of the file to be uploaded.
					Key: key, // The key (path) under which to store the file in the bucket.
					ContentDisposition: `inline; ${filename}`, // Additional headers for the object.
					ContentType: 'image'
				});

				/**
				 * Send a PutObjectCommand to DigitalOcean to upload the object
				 */
				await s3Client.send(putObjectCommand);

				// Input parameters for the HeadObjectCommand when retrieving metadata about an object in DigitalOcean storage.
				const headObjectCommand = new HeadObjectCommand({
					Key: key, // The key (path) of the object for which to retrieve metadata.
					Bucket: this.getDigitalOceanBucket() // The name of the bucket where the object is stored.
				});

				// Send a HeadObjectCommand to DigitalOcean to retrieve ContentLength property metadata
				const { ContentLength } = await s3Client.send(headObjectCommand);

				const file: Partial<UploadedFile> = {
					originalname: filename, // original file name
					size: ContentLength, // files in bytes
					filename: filename,
					path: key, // Full path of the file
					key: key // Full path of the file
				};

				return await this.mapUploadedFile(file);
			} else {
				console.warn('Error while retrieving signed URL: s3Client is null');
			}
		} catch (error) {
			console.error('Error while put file for DigitalOcean provider', error);
		}
	}

	/**
	 * Delete a file from DigitalOcean storage.
	 *
	 * @param key - The key of the file to delete
	 * @returns A Promise that resolves when the file is deleted successfully, or rejects with an error
	 */
	async deleteFile(key: string): Promise<Object | any> {
		try {
			const s3Client = this.getDigitalOceanInstance();

			if (s3Client) {
				// Input parameters when using the DeleteObjectCommand to delete an object from DigitalOcean storage.
				const command = new DeleteObjectCommand({
					Bucket: this.getDigitalOceanBucket(), // The name of the bucket from which to delete the object.
					Key: key // The key (path) of the object to delete from the bucket.
				});

				/**
				 * Send a DeleteObjectCommand to DigitalOcean to delete an object
				 */
				const data: DeleteObjectCommandOutput = await s3Client.send(command);
				return new Object({
					status: HttpStatus.OK,
					message: `file with key: ${key} is successfully deleted`,
					data
				});
			} else {
				console.warn('Error while retrieving signed URL: s3Client is null');
			}
		} catch (error) {
			console.error(`Error while deleting file with key '${key}':`, error);
			throw new HttpException(error, HttpStatus.BAD_REQUEST, {
				description: `Error while deleting file with key: '${key}'`
			});
		}
	}

	/**
	 * Get an AWS S3 instance configured with DigitalOcean details.
	 *
	 * @returns An AWS S3 instance or null in case of an error
	 */
	private getDigitalOceanInstance(): S3Client | null {
		try {
			this.setDigitalOceanConfiguration();

			if (this.config && this.config.digitalocean_access_key_id && this.config.digitalocean_secret_access_key) {
				const endpoint = ensureHttpPrefix(this.config.digitalocean_service_url);

				const s3Client = new S3Client({
					/**
					 * Whether to force path style URLs for S3 objects
					 * (e.g., https://s3.amazonaws.com/<bucketName>/<key> instead of https://<bucketName>.s3.amazonaws.com/<key>
					 */
					forcePathStyle: this.config.digitalocean_s3_force_path_style || true, // Configures to use subdomain/virtual calling format.
					endpoint,
					region: this.config.digitalocean_default_region || 'us-east-1',
					credentials: {
						accessKeyId: this.config.digitalocean_access_key_id,
						secretAccessKey: this.config.digitalocean_secret_access_key
					}
				});

				return s3Client;
			} else {
				console.warn(
					`Can't retrieve ${FileStorageProviderEnum.DIGITALOCEAN} instance for tenant: this.config.digitalocean_service_url, digitalocean_access_key_id or digitalocean_secret_access_key undefined in that tenant settings`
				);
				return null;
			}
		} catch (error) {
			console.error(`Error while retrieving ${FileStorageProviderEnum.DIGITALOCEAN} instance:`, error);
			return null;
		}
	}

	/**
	 * Get the DigitalOcean bucket from the configuration.
	 *
	 * @returns The DigitalOcean bucket name or null if not configured
	 */
	public getDigitalOceanBucket(): string | null {
		this.setDigitalOceanConfiguration();
		return this.config.digitalocean_s3_bucket || null;
	}

	/**
	 * Map a partial UploadedFile object to include filename and URL.
	 *
	 * @param file - The partial UploadedFile object to map
	 * @returns The mapped file object
	 */
	public async mapUploadedFile(file: any): Promise<UploadedFile> {
		file.filename = file.originalname;
		file.url = await this.url(file.key); // file.location;
		return file;
	}
}
