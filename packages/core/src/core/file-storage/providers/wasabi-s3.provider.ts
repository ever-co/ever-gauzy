import { FileStorageOption, FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import * as multerS3 from 'multer-s3';
import { basename, join } from 'path';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import * as AWS from 'aws-sdk';
import { S3Client } from "@aws-sdk/client-s3";
import { StorageEngine } from 'multer';
import { Provider } from './provider';
import { RequestContext } from '../../context';

/**
 * Wasabi Configuration
 */
const { wasabi } = environment;

export interface IWasabiConfig {
	rootPath: string;
	wasabi_aws_access_key_id: string;
	wasabi_aws_secret_access_key: string;
	wasabi_aws_default_region: string;
	wasabi_aws_service_url: string;
	wasabi_aws_bucket: string;
}

interface IWasabiRegionServiceURL {
	region: string;
	serviceUrl: string;
}

/**
 *
 */
const REGION_SERVICE_URLS: IWasabiRegionServiceURL[] = [
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

/**
 *
 */
export class WasabiS3Provider extends Provider<WasabiS3Provider> {

	public static instance: WasabiS3Provider;
	public name = FileStorageProviderEnum.WASABI;
	public tenantId: string;
	public config: IWasabiConfig;
	public defaultConfig: IWasabiConfig;

	constructor() {
		super();
		this.config = this.defaultConfig = {
			rootPath: '',
			wasabi_aws_access_key_id: wasabi.accessKeyId,
			wasabi_aws_secret_access_key: wasabi.secretAccessKey,
			wasabi_aws_bucket: wasabi.s3.bucket,
			...this._mapDefaultWasabiServiceUrl(wasabi.region, wasabi.serviceUrl)
		};
	}

	/**
	* Get the singleton instance of WasabiS3Provider
	* @returns {WasabiS3Provider} The singleton instance
	*/
	getInstance(): WasabiS3Provider {
		if (!WasabiS3Provider.instance) {
			WasabiS3Provider.instance = new WasabiS3Provider();
		}
		this.setWasabiDetails();
		return WasabiS3Provider.instance;
	}

	/**
	 * Set Wasabi details based on the current request's tenantSettings
	 */
	private setWasabiDetails() {
		const request = RequestContext.currentRequest();
		if (request) {
			const settings = request['tenantSettings'] || {};
			if (isNotEmpty(settings)) {
				/** */
				this.config = {
					...this.defaultConfig,
					wasabi_aws_access_key_id: this.trimAndGetValue(settings.wasabi_aws_access_key_id),
					wasabi_aws_secret_access_key: this.trimAndGetValue(settings.wasabi_aws_secret_access_key),
					wasabi_aws_service_url: this.trimAndGetValue(settings.wasabi_aws_service_url),
					wasabi_aws_default_region: this.trimAndGetValue(settings.wasabi_aws_default_region),
					wasabi_aws_bucket: this.trimAndGetValue(settings.wasabi_aws_bucket),
				};
			}
		} else {
			this.config = {
				...this.defaultConfig
			};
		}
	}

	/**
	 * Trim a string value and return it if not empty, otherwise return undefined
	 * @param value - The string value to trim
	 * @returns Trimmed string value or undefined if empty
	 */
	private trimAndGetValue(value?: string): string | undefined {
		return isNotEmpty(value) ? value.trim() : undefined;
	}

	/**
	 * Get a pre-signed URL for a given file URL.
	 *
	 * @param fileURL - The file URL for which to generate a pre-signed URL
	 * @returns Pre-signed URL or null if the input is invalid
	 */
	public url(fileURL: string): string | null {
		if (!fileURL || fileURL.startsWith('http')) {
			return fileURL;
		}

		try {
			const url = this.getWasabiInstance().getSignedUrl('getObject', {
				Bucket: this.getWasabiBucket(),
				Key: fileURL,
				Expires: 3600
			});
			return url;
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
	async getFile(key: string): Promise<Buffer> {
		const s3 = this.getWasabiInstance();
		const params = {
			Bucket: this.getWasabiBucket(),
			Key: key
		};

		try {
			const data = await s3.getObject(params).promise();
			return data.Body as Buffer;
		} catch (error) {
			console.error(`Error while fetching file with key '${key}':`, error);
			throw error; // Rethrow the error for the caller to handle
		}
	}

	/**
	 *
	 * @param fileContent
	 * @param key
	 * @returns
	 */
	async putFile(fileContent: string, key: string = ''): Promise<any> {
		return new Promise((putFileResolve, reject) => {
			const fileName = basename(key);
			const s3 = this.getWasabiInstance();
			const params = {
				Bucket: this.getWasabiBucket(),
				Body: fileContent,
				Key: key,
				ContentDisposition: `inline; ${fileName}`
			};
			s3.putObject(params, async (err) => {
				if (err) {
					reject(err);
				} else {
					const size = await s3
						.headObject({ Key: key, Bucket: this.getWasabiBucket() })
						.promise()
						.then((res) => res.ContentLength);

					const file: Partial<UploadedFile> = {
						originalname: fileName, // original file name
						size: size, // files in bytes
						filename: fileName,
						path: key, // Full path of the file
						key: key // Full path of the file
					};
					putFileResolve(this.mapUploadedFile(file));
				}
			});
		});
	}

	/**
	 * Delete a file from Wasabi storage.
	 *
	 * @param key - The key of the file to delete
	 * @returns A Promise that resolves when the file is deleted successfully, or rejects with an error
	 */
	deleteFile(key: string): Promise<void> {
		const s3 = this.getWasabiInstance();
		const params = {
			Bucket: this.getWasabiBucket(),
			Key: key
		};

		return new Promise((resolve, reject) => {
			s3.deleteObject(params, (error, data) => {
				if (error) {
					console.error(`Error while deleting file with key '${key}':`, error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	/**
	* Get an AWS S3 instance configured with Wasabi details.
	*
	* @returns An AWS S3 instance or null in case of an error
	*/
	private getWasabiInstance(): AWS.S3 | null {
		try {
			this.setWasabiDetails();

			const endpoint = new AWS.Endpoint(this.config.wasabi_aws_service_url);
			return new AWS.S3({
				accessKeyId: this.config.wasabi_aws_access_key_id,
				secretAccessKey: this.config.wasabi_aws_secret_access_key,
				region: this.config.wasabi_aws_default_region,
				endpoint: endpoint
			});
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
		this.setWasabiDetails();
		return this.config.wasabi_aws_bucket || null;
	}

	/**
	 * Map a partial UploadedFile object to include filename and URL.
	 *
	 * @param file - The partial UploadedFile object to map
	 * @returns The mapped file object
	 */
	public mapUploadedFile(file: Partial<UploadedFile>): any {
		file.filename = file.originalname;
		file.url = this.url(file.key); // file.location;
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
		let item = REGION_SERVICE_URLS.find((item: IWasabiRegionServiceURL) => {
			if (region) {
				return item.region === region;
			} else if (!region && serviceUrl) {
				return item.serviceUrl === serviceUrl;
			}
			return item.region === 'us-east-1';
		});

		// Default to 'us-east-1' if no matching region or serviceUrl is found
		if (!item) {
			item = REGION_SERVICE_URLS.find((item: IWasabiRegionServiceURL) => item.region === 'us-east-1');
		}

		return {
			wasabi_aws_default_region: item.region,
			wasabi_aws_service_url: item.serviceUrl
		};
	}
}
