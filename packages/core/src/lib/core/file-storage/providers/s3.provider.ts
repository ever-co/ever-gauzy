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
import { trimAndGetValue } from '@gauzy/common';
import { Provider } from './provider';
import { RequestContext } from '../../context';

/**
 * Configuration interface for AWS S3 storage.
 */
export interface IS3ProviderConfig {
	// The root path for the S3 storage. This could represent a prefix or directory structure.
	rootPath: string;

	// The AWS access key ID used for authentication.
	aws_access_key_id: string;

	// The AWS secret access key used for authentication.
	aws_secret_access_key: string;

	// The default AWS region for S3.
	aws_default_region: string;

	// The name of the AWS S3 bucket.
	aws_bucket: string;

	// Whether to force path style URLs for S3 objects
	aws_force_path_style: boolean;
}

export class S3Provider extends Provider<S3Provider> {
	public instance: S3Provider;
	public readonly name = FileStorageProviderEnum.S3;
	public config: IS3ProviderConfig;
	public defaultConfig: IS3ProviderConfig;

	private readonly _detailedLoggingEnabled = false;

	constructor() {
		super();
		this.config = this.defaultConfig = {
			rootPath: '',
			aws_access_key_id: environment.awsConfig.accessKeyId,
			aws_secret_access_key: environment.awsConfig.secretAccessKey,
			aws_default_region: environment.awsConfig.region,
			aws_bucket: environment.awsConfig.s3.bucket,
			aws_force_path_style: environment.awsConfig.s3.forcePathStyle
		};
	}

	/**
	 * Get the singleton instance of S3Provider
	 * @returns {S3Provider} The singleton instance
	 */
	getProviderInstance(): S3Provider {
		if (!this.instance) {
			this.instance = new S3Provider();
		}

		this.setAwsS3Configuration();
		return this.instance;
	}

	/**
	 * Sets the AWS S3 configuration based on the current request's tenant settings.
	 * If tenant settings are available with valid AWS credentials, it updates the configuration.
	 * If not, it uses the default configuration.
	 */
	setAwsS3Configuration() {
		// Use the default configuration as a starting point
		this.config = {
			...this.defaultConfig
		};

		try {
			const request = RequestContext.currentRequest();

			if (request) {
				const settings = request['tenantSettings'];

				if (settings) {
					if (this._detailedLoggingEnabled)
						console.log(`setWasabiConfiguration Tenant Settings value: ${JSON.stringify(settings)}`);

					if (trimAndGetValue(settings.aws_access_key_id))
						this.config.aws_access_key_id = trimAndGetValue(settings.aws_access_key_id);

					if (trimAndGetValue(settings.aws_secret_access_key))
						this.config.aws_secret_access_key = trimAndGetValue(settings.aws_secret_access_key);

					if (trimAndGetValue(settings.aws_default_region))
						this.config.aws_default_region = trimAndGetValue(settings.aws_default_region);

					if (trimAndGetValue(settings.aws_bucket))
						this.config.aws_bucket = trimAndGetValue(settings.aws_bucket);

					const forcePathStyle = trimAndGetValue(settings.aws_force_path_style);

					if (forcePathStyle) {
						this.config.aws_force_path_style = forcePathStyle === 'true' || forcePathStyle === '1';
					} else {
						this.config.aws_force_path_style = false;
					}
				}
			}
		} catch (error) {
			console.error('Error while setting S3 configuration. Default configuration will be used', error);
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
			const s3Client = this.getS3Instance();

			const signedUrl = await getSignedUrl(
				s3Client,
				new GetObjectCommand({
					Bucket: this.getS3Bucket(),
					Key: fileURL
				}),
				{
					expiresIn: 3600
				}
			);

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
	 * Create a Multer storage engine configured for AWS S3.
	 *
	 * @param options - Configuration options for the storage engine
	 * @returns A Multer storage engine
	 */
	public handler(options: FileStorageOption): StorageEngine {
		const { dest, filename, prefix = 'file' } = options;

		try {
			const s3Client = this.getS3Instance();

			if (s3Client) {
				return multerS3({
					s3: s3Client,
					bucket: this.getS3Bucket(),
					metadata: function (_req, file, cb) {
						cb(null, { fieldName: file.fieldname });
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
				console.warn('Error while retrieving Multer for S3: s3Client is null');
				return null;
			}
		} catch (error) {
			console.error('Error while retrieving Multer for S3:', error);
			return null;
		}
	}

	/**
	 * Get a file from AWS S3 storage.
	 *
	 * @param key - The key of the file to retrieve
	 * @returns A Promise resolving to a Buffer containing the file data
	 */
	async getFile(key: string): Promise<Buffer | any> {
		try {
			const s3Client = this.getS3Instance();

			// Input parameters when using the GetObjectCommand to retrieve an object from Wasabi storage.
			const command = new GetObjectCommand({
				Bucket: this.getS3Bucket(), // The name of the bucket from which to retrieve the object.
				Key: key // The key (path) of the object to retrieve from the bucket.
			});

			/**
			 * Send a GetObjectCommand to Wasabi to retrieve an object
			 */
			const data: GetObjectCommandOutput = await s3Client.send(command);
			return data.Body;
		} catch (error) {
			console.error(`Error while fetching file with key '${key}':`, error);
		}
	}

	/**
	 * Upload a file to AWS S3 storage.
	 *
	 * @param fileContent - The content of the file to upload
	 * @param key - The key under which to store the file
	 * @returns A Promise resolving to an UploadedFile, or undefined on error
	 */
	async putFile(fileContent: string, key: string = ''): Promise<UploadedFile> {
		try {
			// Replace double backslashes with single forward slashes
			key = key.replace(/\\/g, '/');

			const s3Client = this.getS3Instance();
			const filename = basename(key);

			// Input parameters for the PutObjectCommand when uploading a file to AWS S3 storage.
			const putObjectCommand = new PutObjectCommand({
				Bucket: this.getS3Bucket(), // The name of the bucket to which the file should be uploaded.
				Body: fileContent, // The content of the file to be uploaded.
				Key: key, // The key (path) under which to store the file in the bucket.
				ContentDisposition: `inline; ${filename}`, // Additional headers for the object.
				ContentType: 'image'
			});

			/**
			 * Send a PutObjectCommand to AWS S3 to upload the object
			 */
			await s3Client.send(putObjectCommand);

			// Input parameters for the HeadObjectCommand when retrieving metadata about an object in AWS S3 storage.
			const headObjectCommand = new HeadObjectCommand({
				Key: key, // The key (path) of the object for which to retrieve metadata.
				Bucket: this.getS3Bucket() // The name of the bucket where the object is stored.
			});

			// Send a HeadObjectCommand to AWS S3 to retrieve ContentLength property metadata
			const { ContentLength } = await s3Client.send(headObjectCommand);

			const file: Partial<UploadedFile> = {
				originalname: filename, // original file name
				size: ContentLength, // files in bytes
				filename: filename,
				path: key, // Full path of the file
				key: key // Full path of the file
			};

			return await this.mapUploadedFile(file);
		} catch (error) {
			console.log('Error while put file for aws S3 provider', error);
		}
	}

	/**
	 * Delete a file from AWS S3 storage.
	 *
	 * @param key - The key of the file to delete
	 * @returns A Promise that resolves when the file is deleted successfully, or rejects with an error
	 */
	async deleteFile(key: string): Promise<Object | any> {
		try {
			const s3Client = this.getS3Instance();

			// Input parameters when using the DeleteObjectCommand to delete an object from AWS S3 storage.
			const command = new DeleteObjectCommand({
				Bucket: this.getS3Bucket(), // The name of the bucket from which to delete the object.
				Key: key // The key (path) of the object to delete from the bucket.
			});

			/**
			 * Send a DeleteObjectCommand to AWS S3 to delete an object
			 */
			const data: DeleteObjectCommandOutput = await s3Client.send(command);
			return new Object({
				status: HttpStatus.OK,
				message: `file with key: ${key} is successfully deleted`,
				data
			});
		} catch (error) {
			console.error(`Error while deleting file with key '${key}':`, error);
			throw new HttpException(error, HttpStatus.BAD_REQUEST, {
				description: `Error while deleting file with key: '${key}'`
			});
		}
	}

	/**
	 * Retrieves or creates an instance of the S3Client class based on the AWS S3 configuration.
	 *
	 * @returns An instance of the S3Client class or null if there is an error.
	 */
	private getS3Instance(): S3Client | null {
		try {
			this.setAwsS3Configuration();

			// Create S3 region
			const region = this.config.aws_default_region || 'us-east-1';

			if (this.config.aws_access_key_id && this.config.aws_secret_access_key) {
				const s3Client = new S3Client({
					credentials: {
						accessKeyId: this.config.aws_access_key_id,
						secretAccessKey: this.config.aws_secret_access_key
					},
					region,
					/**
					 * Whether to force path style URLs for S3 objects
					 * (e.g., https://s3.amazonaws.com/<bucketName>/<key> instead of https://<bucketName>.s3.amazonaws.com/<key>
					 */
					forcePathStyle: this.config.aws_force_path_style
				});

				return s3Client;
			} else {
				console.warn(`Can't retrieve ${FileStorageProviderEnum.S3} instance: AWS credentials are missing`);
				return null;
			}
		} catch (error) {
			console.error(`Error while retrieving ${FileStorageProviderEnum.S3} instance:`, error);
			return null;
		}
	}

	/**
	 * Get the AWS S3 bucket from the configuration.
	 *
	 * @returns The AWS S3 bucket name or null if not configured
	 */
	public getS3Bucket(): string | null {
		this.setAwsS3Configuration();
		return this.config.aws_bucket || null;
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
