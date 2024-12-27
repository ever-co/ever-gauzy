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
import { addHttpsPrefix, trimAndGetValue } from '@gauzy/common';
import { Provider } from './provider';
import { RequestContext } from '../../context';

/**
 * Wasabi Configuration
 */
const { wasabi } = environment;

/**
 * Configuration interface for Wasabi storage.
 */
export interface IWasabiProviderConfig {
	// Root path for Wasabi storage
	rootPath: string;

	// AWS access key ID for Wasabi
	wasabi_aws_access_key_id: string;

	// AWS secret access key for Wasabi
	wasabi_aws_secret_access_key: string;

	// AWS default region for Wasabi
	wasabi_aws_default_region: string;

	// AWS service URL for Wasabi
	wasabi_aws_service_url: string;

	// AWS bucket name for Wasabi
	wasabi_aws_bucket: string;

	// Whether to force path style URLs for Wasabi objects
	wasabi_aws_force_path_style: boolean;
}

/**
 * Interface representing the mapping between a Wasabi region and its associated service URL.
 */
export interface IWasabiRegionServiceURL {
	// The Wasabi region
	region: string;

	// The service URL associated with the Wasabi region
	serviceUrl: string;
}

/**
 * Array containing mappings between Wasabi regions and their corresponding service URLs.
 */
const WASABI_REGION_SERVICE_URLS: IWasabiRegionServiceURL[] = [
	{
		region: 'us-east-1',
		serviceUrl: 'https://s3.wasabisys.com'
	},
	{
		region: 'us-east-2',
		serviceUrl: 'https://s3.us-east-2.wasabisys.com'
	},
	{
		region: 'us-central-1',
		serviceUrl: 'https://s3.us-central-1.wasabisys.com'
	},
	{
		region: 'us-west-1',
		serviceUrl: 'https://s3.us-west-1.wasabisys.com'
	},
	{
		region: 'eu-central-1',
		serviceUrl: 'https://s3.eu-central-1.wasabisys.com'
	},
	{
		region: 'eu-west-1',
		serviceUrl: 'https://s3.eu-west-1.wasabisys.com'
	},
	{
		region: 'eu-west-2',
		serviceUrl: 'https://s3.eu-west-2.wasabisys.com'
	},
	{
		region: 'ap-northeast-1',
		serviceUrl: 'https://s3.ap-northeast-1.wasabisys.com'
	},
	{
		region: 'ap-northeast-2',
		serviceUrl: 'https://s3.ap-northeast-2.wasabisys.com'
	}
];

export class WasabiS3Provider extends Provider<WasabiS3Provider> {
	public instance: WasabiS3Provider;
	public readonly name = FileStorageProviderEnum.WASABI;
	public config: IWasabiProviderConfig;
	public defaultConfig: IWasabiProviderConfig;

	private readonly _detailedloggingEnabled = false;

	constructor() {
		super();
		this.config = this.defaultConfig = {
			rootPath: '',
			wasabi_aws_access_key_id: wasabi.accessKeyId,
			wasabi_aws_secret_access_key: wasabi.secretAccessKey,
			wasabi_aws_bucket: wasabi.s3.bucket,
			wasabi_aws_force_path_style: wasabi.s3.forcePathStyle,
			...this._mapDefaultWasabiServiceUrl(wasabi.region, addHttpsPrefix(wasabi.serviceUrl))
		};
	}

	/**
	 * Get the singleton instance of WasabiS3Provider
	 * @returns {WasabiS3Provider} The singleton instance
	 */
	getProviderInstance(): WasabiS3Provider {
		if (!this.instance) {
			this.instance = new WasabiS3Provider();
		}

		this.setWasabiConfiguration();
		return this.instance;
	}

	/**
	 * Set Wasabi details based on the current request's tenantSettings.
	 * If such settings does not have any Wasabi details, use the default configuration.
	 * If they have Wasabi details, use them to override the default configuration.
	 */
	private setWasabiConfiguration() {
		// Use the default configuration as a starting point
		this.config = {
			...this.defaultConfig
		};

		if (this._detailedloggingEnabled)
			console.log(`setWasabiConfiguration this.config value: ${JSON.stringify(this.config)}`);

		try {
			const request = RequestContext.currentRequest();

			if (request) {
				const settings = request['tenantSettings'];

				if (settings) {
					if (this._detailedloggingEnabled) {
						console.log(`setWasabiConfiguration Tenant Settings Value: ${JSON.stringify(settings)}`);
					}

					if (trimAndGetValue(settings.wasabi_aws_access_key_id)) {
						this.config.wasabi_aws_access_key_id = trimAndGetValue(settings.wasabi_aws_access_key_id);

						if (this._detailedloggingEnabled) {
							console.log(`setWasabiConfiguration this.config.wasabi_aws_access_key_id value: ${this.config.wasabi_aws_access_key_id}`);
						}
					}

					if (trimAndGetValue(settings.wasabi_aws_secret_access_key)) {
						this.config.wasabi_aws_secret_access_key = trimAndGetValue(settings.wasabi_aws_secret_access_key);

						if (this._detailedloggingEnabled) {
							console.log(`setWasabiConfiguration this.config.wasabi_aws_secret_access_key value: ${this.config.wasabi_aws_secret_access_key}`);
						}
					}

					if (trimAndGetValue(settings.wasabi_aws_service_url)) {
						this.config.wasabi_aws_service_url = addHttpsPrefix(trimAndGetValue(settings.wasabi_aws_service_url));

						if (this._detailedloggingEnabled) {
							console.log('setWasabiConfiguration this.config.wasabi_aws_service_url value: ', this.config.wasabi_aws_service_url);
						}
					}

					if (trimAndGetValue(settings.wasabi_aws_default_region)) {
						this.config.wasabi_aws_default_region = trimAndGetValue(settings.wasabi_aws_default_region);

						if (this._detailedloggingEnabled) {
							console.log('setWasabiConfiguration this.config.wasabi_aws_default_region value: ', this.config.wasabi_aws_default_region);
						}
					}

					if (trimAndGetValue(settings.wasabi_aws_bucket)) {
						this.config.wasabi_aws_bucket = trimAndGetValue(settings.wasabi_aws_bucket);

						if (this._detailedloggingEnabled) {
							console.log('setWasabiConfiguration this.config.wasabi_aws_bucket value: ', this.config.wasabi_aws_bucket);
						}
					}

					// Assuming trimAndGetValue() function trims and retrieves the value from settings
					const forcePathStyle = trimAndGetValue(settings.wasabi_aws_force_path_style);
					this.config.wasabi_aws_force_path_style = forcePathStyle === 'true' || forcePathStyle === '1';

					if (this._detailedloggingEnabled) {
						console.log('setWasabiConfiguration this.config.wasabi_aws_force_path_style value: ', this.config.wasabi_aws_force_path_style);
					}
				}
			}
		} catch (error) {
			console.error('Error while setting Wasabi configuration. Default configuration will be used', error);
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
			const s3Client = this.getWasabiInstance();

			if (s3Client) {
				const signedUrl = await getSignedUrl(
					s3Client,
					new GetObjectCommand({
						Bucket: this.getWasabiBucket(),
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
	 * Create a Multer storage engine configured for AWS S3 (Wasabi).
	 *
	 * @param options - Configuration options for the storage engine
	 * @returns A Multer storage engine
	 */
	public handler(options: FileStorageOption): StorageEngine {
		const { dest, filename, prefix = 'file' } = options;

		try {
			const s3Client = this.getWasabiInstance();

			if (s3Client) {
				return multerS3({
					s3: s3Client,
					bucket: (_req, _file, callback) => {
						callback(null, this.getWasabiBucket());
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
							fileName = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}.${extension}`;
						}

						// Replace double backslashes with single forward slashes
						const fullPath = join(destination, fileName).replace(/\\/g, '/');

						callback(null, fullPath);
					}
				});
			} else {
				console.error('Error while retrieving Multer for Wasabi: s3Client is null');
				return null;
			}
		} catch (error) {
			console.error('Error while retrieving Multer for Wasabi:', error);
			return null;
		}
	}

	/**
	 * Get a file from Wasabi storage.
	 *
	 * @param key - The key of the file to retrieve
	 * @returns A Promise resolving to a Buffer containing the file data
	 */
	async getFile(key: string): Promise<Buffer | any> {
		try {
			const s3Client = this.getWasabiInstance();

			if (s3Client) {
				// Input parameters when using the GetObjectCommand to retrieve an object from Wasabi storage.
				const command = new GetObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket from which to retrieve the object.
					Key: key // The key (path) of the object to retrieve from the bucket.
				});

				/**
				 * Send a GetObjectCommand to Wasabi to retrieve an object
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
	 * Upload a file to Wasabi storage.
	 *
	 * @param fileContent - The content of the file to upload
	 * @param key - The key under which to store the file
	 * @returns A Promise resolving to an UploadedFile, or undefined on error
	 */
	async putFile(fileContent: string, key: string = ''): Promise<UploadedFile> {
		try {
			// Replace double backslashes with single forward slashes
			key = key.replace(/\\/g, '/');

			const s3Client = this.getWasabiInstance();

			if (s3Client) {
				const filename = basename(key);

				// Input parameters for the PutObjectCommand when uploading a file to Wasabi storage.
				const putObjectCommand = new PutObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket to which the file should be uploaded.
					Body: fileContent, // The content of the file to be uploaded.
					Key: key, // The key (path) under which to store the file in the bucket.
					ContentDisposition: `inline; ${filename}`, // Additional headers for the object.
					ContentType: 'image'
				});

				/**
				 * Send a PutObjectCommand to Wasabi to upload the object
				 */
				await s3Client.send(putObjectCommand);

				// Input parameters for the HeadObjectCommand when retrieving metadata about an object in Wasabi storage.
				const headObjectCommand = new HeadObjectCommand({
					Key: key, // The key (path) of the object for which to retrieve metadata.
					Bucket: this.getWasabiBucket() // The name of the bucket where the object is stored.
				});

				// Send a HeadObjectCommand to Wasabi to retrieve ContentLength property metadata
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
			console.error('Error while put file for wasabi provider', error);
		}
	}

	/**
	 * Delete a file from Wasabi storage.
	 *
	 * @param key - The key of the file to delete
	 * @returns A Promise that resolves when the file is deleted successfully, or rejects with an error
	 */
	async deleteFile(key: string): Promise<Object | any> {
		try {
			const s3Client = this.getWasabiInstance();

			if (s3Client) {
				// Input parameters when using the DeleteObjectCommand to delete an object from Wasabi storage.
				const command = new DeleteObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket from which to delete the object.
					Key: key // The key (path) of the object to delete from the bucket.
				});

				/**
				 * Send a DeleteObjectCommand to Wasabi to delete an object
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
	 * Get an AWS S3 instance configured with Wasabi details.
	 *
	 * @returns An AWS S3 instance or null in case of an error
	 */
	private getWasabiInstance(): S3Client | null {
		try {
			this.setWasabiConfiguration();

			if (
				this.config.wasabi_aws_service_url &&
				this.config.wasabi_aws_access_key_id &&
				this.config.wasabi_aws_secret_access_key
			) {
				const endpoint = addHttpsPrefix(this.config.wasabi_aws_service_url);

				const s3Client = new S3Client({
					credentials: {
						accessKeyId: this.config.wasabi_aws_access_key_id,
						secretAccessKey: this.config.wasabi_aws_secret_access_key
					},
					region: this.config.wasabi_aws_default_region || 'us-east-1',
					endpoint,
					/**
					 * Whether to force path style URLs for S3 objects
					 *
					 * https://s3.wasabisys.com
					 * (e.g., https://s3.wasabisys.com/<bucketName>/<key> instead of https://<bucketName>.s3.wasabisys.com/<key>
					 */
					forcePathStyle: this.config.wasabi_aws_force_path_style
				});

				return s3Client;
			} else {
				console.warn(
					`Can't retrieve ${FileStorageProviderEnum.WASABI} instance for tenant: this.config.wasabi_aws_service_url, wasabi_aws_access_key_id or wasabi_aws_secret_access_key undefined in that tenant settings`
				);

				return null;
			}
		} catch (error) {
			console.error(`Error while retrieving ${FileStorageProviderEnum.WASABI} instance:`, error);
			return null;
		}
	}

	/**
	 * Get the Wasabi bucket from the configuration.
	 *
	 * @returns The Wasabi bucket name or null if not configured
	 */
	public getWasabiBucket(): string | null {
		this.setWasabiConfiguration();
		return this.config.wasabi_aws_bucket || null;
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

	/**
	 * Mapped default Wasabi service URLs
	 *
	 * @param region - Wasabi region
	 * @param serviceUrl - Wasabi service URL
	 * @returns { wasabi_aws_default_region: string, wasabi_aws_service_url: string }
	 */
	private _mapDefaultWasabiServiceUrl(
		region?: string,
		serviceUrl?: string
	): {
		wasabi_aws_default_region: string;
		wasabi_aws_service_url: string;
	} {
		let item = WASABI_REGION_SERVICE_URLS.find((item: IWasabiRegionServiceURL) => {
			if (region) {
				return item.region === region;
			} else if (!region && serviceUrl) {
				return item.serviceUrl === serviceUrl;
			}
			return item.region === 'us-east-1';
		});

		// Default to 'us-east-1' if no matching region or serviceUrl is found
		if (!item) {
			item = WASABI_REGION_SERVICE_URLS.find((item: IWasabiRegionServiceURL) => item.region === 'us-east-1');
		}

		return {
			wasabi_aws_default_region: item.region,
			wasabi_aws_service_url: item.serviceUrl
		};
	}
}
