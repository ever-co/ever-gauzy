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
import { addHttpsPrefix, isNotEmpty, trimAndGetValue } from '@gauzy/common';
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

	constructor() {
		super();
		this.config = this.defaultConfig = {
			rootPath: '',
			wasabi_aws_access_key_id: wasabi.accessKeyId,
			wasabi_aws_secret_access_key: wasabi.secretAccessKey,
			wasabi_aws_bucket: wasabi.s3.bucket,
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
	 * Set Wasabi details based on the current request's tenantSettings
	*/
	private setWasabiConfiguration() {
		// Use the default configuration as a starting point
		this.config = {
			...this.defaultConfig
		};

		// Check if there is a current request
		const request = RequestContext.currentRequest();

		if (request) {
			// Retrieve tenant settings from the request, defaulting to an empty object
			const settings = request['tenantSettings'] || {};

			// Check if there are non-empty tenant settings
			if (isNotEmpty(settings)) {
				// Update the configuration with trimmed and valid values from tenant settings
				this.config = {
					...this.defaultConfig,
					wasabi_aws_access_key_id: trimAndGetValue(settings.wasabi_aws_access_key_id),
					wasabi_aws_secret_access_key: trimAndGetValue(settings.wasabi_aws_secret_access_key),
					wasabi_aws_service_url: addHttpsPrefix(trimAndGetValue(settings.wasabi_aws_service_url)),
					wasabi_aws_default_region: trimAndGetValue(settings.wasabi_aws_default_region),
					wasabi_aws_bucket: trimAndGetValue(settings.wasabi_aws_bucket),
				};
			}
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

			const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
				Bucket: this.getWasabiBucket(),
				Key: fileURL,
			}), {
				expiresIn: 3600
			});

			return signedUrl;
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

		return multerS3({
			s3: this.getWasabiInstance(),
			bucket: (_req, _file, callback) => {
				callback(null, this.getWasabiBucket())
			},
			metadata: function (_req, file, callback) {
				callback(null, { fieldName: file.fieldname });
			},
			key: (_req, file, callback) => {
				// A string or function that determines the destination path for uploaded
				const dir = dest instanceof Function ? dest(file) : dest;

				// A file extension, or filename extension, is a suffix at the end of a file.
				const extension = file.originalname.split('.').pop();

				// A function that determines the name of the uploaded file.
				let fileName: string;

				if (filename) {
					fileName = (typeof filename === 'string') ? filename : filename(file, extension);
				} else {
					fileName = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}.${extension}`;
				}

				const fullPath = join(this.config.rootPath, dir, fileName);
				callback(null, fullPath);
			}
		});
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

			/**
			 * Send a GetObjectCommand to Wasabi to retrieve an object
			 */
			const data: GetObjectCommandOutput = await s3Client.send(
				// Input parameters when using the GetObjectCommand to retrieve an object from Wasabi storage.
				new GetObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket from which to retrieve the object.
					Key: key, // The key (path) of the object to retrieve from the bucket.
				})
			);
			return data.Body;
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
			const s3Client = this.getWasabiInstance();
			const filename = basename(key);

			/**
			 * Send a PutObjectCommand to Wasabi to upload the object
			 */
			await s3Client.send(
				// Input parameters for the PutObjectCommand when uploading a file to Wasabi storage.
				new PutObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket to which the file should be uploaded.
					Body: fileContent, // The content of the file to be uploaded.
					Key: key, // The key (path) under which to store the file in the bucket.
					ContentDisposition: `inline; ${filename}` // Additional headers for the object.
				})
			);

			// Send a HeadObjectCommand to Wasabi to retrieve ContentLength property metadata
			const { ContentLength } = await s3Client.send(
				// Input parameters for the HeadObjectCommand when retrieving metadata about an object in Wasabi storage.
				new HeadObjectCommand({
					Key: key, // The key (path) of the object for which to retrieve metadata.
					Bucket: this.getWasabiBucket() // The name of the bucket where the object is stored.
				})
			);

			const file: Partial<UploadedFile> = {
				originalname: filename, // original file name
				size: ContentLength, // files in bytes
				filename: filename,
				path: key, // Full path of the file
				key: key // Full path of the file
			};

			return await this.mapUploadedFile(file)
		} catch (error) {
			console.log('Error while put file for wasabi provider', error);
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

			/**
			 * Send a DeleteObjectCommand to Wasabi to delete an object
			 */
			const data: DeleteObjectCommandOutput = await s3Client.send(
				// Input parameters when using the DeleteObjectCommand to delete an object from Wasabi storage.
				new DeleteObjectCommand({
					Bucket: this.getWasabiBucket(), // The name of the bucket from which to delete the object.
					Key: key // The key (path) of the object to delete from the bucket.
				})
			);
			return new Object({
				status: HttpStatus.OK,
				message: `file with key: ${key} is successfully deleted`,
				data,
			});
		} catch (error) {
			console.error(`Error while deleting file with key '${key}':`, error);
			throw new HttpException(error, HttpStatus.BAD_REQUEST, { description: `Error while deleting file with key: '${key}'` });
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

			// Create S3 wasabi endpoint
			const endpoint = addHttpsPrefix(this.config.wasabi_aws_service_url);

			// Create S3 wasabi region
			const region = this.config.wasabi_aws_default_region;

			// Create S3 client service object
			const s3Client = new S3Client({
				credentials: {
					accessKeyId: this.config.wasabi_aws_access_key_id,
					secretAccessKey: this.config.wasabi_aws_secret_access_key,
				},
				region,
				endpoint
			});

			return s3Client;
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
	private _mapDefaultWasabiServiceUrl(region?: string, serviceUrl?: string): {
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
