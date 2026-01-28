import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import * as multerS3 from 'multer-s3';
import { basename, join } from 'path';
import {
	S3Client,
	DeleteObjectCommand,
	DeleteObjectCommandOutput,
	GetObjectCommand,
	GetObjectCommandOutput,
	PutObjectCommand,
	HeadObjectCommand,
	HeadObjectCommandOutput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageEngine } from 'multer';
import {
	FileStorageOption,
	FileStorageProviderEnum,
	FileSystem,
	UploadedFile,
	IWasabiFileStorageProviderConfig
} from '@gauzy/contracts';
import { ensureHttpPrefix, trimIfNotEmpty, parseToBoolean } from '@gauzy/utils';
import { Provider } from './provider';
import { IWasabiConfig, IWasabiConfigProvider } from './interfaces';
import {
	WASABI_CONFIG,
	WASABI_CONFIG_PROVIDER,
	resolveRegionAndServiceUrl,
	DEFAULT_WASABI_REGION,
	DEFAULT_WASABI_SERVICE_URL
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
 * Wasabi S3 Storage Provider
 *
 * A flexible and reusable storage provider for Wasabi's S3-compatible cloud storage.
 * This provider can be used standalone or with dependency injection.
 *
 * Features:
 * - Fully compatible with @gauzy/core FileStorage system
 * - Standalone usage without any framework
 * - NestJS dependency injection support
 * - Dynamic/tenant-aware configuration
 * - Multer integration for file uploads
 * - Pre-signed URL generation
 *
 * @example
 * // Standalone usage
 * const provider = new WasabiS3Provider();
 * provider.setConfig({
 *   accessKeyId: 'your-access-key',
 *   secretAccessKey: 'your-secret-key',
 *   bucket: 'your-bucket',
 *   region: 'us-east-1'
 * });
 *
 * @example
 * // With NestJS DI
 * @Injectable()
 * class MyService {
 *   constructor(private readonly wasabiProvider: WasabiS3Provider) {}
 * }
 */
@Injectable()
export class WasabiS3Provider extends Provider<WasabiS3Provider> {
	/**
	 * Provider name matching FileStorageProviderEnum.WASABI
	 * Required for integration with core FileStorage system
	 */
	public readonly name = FileStorageProviderEnum.WASABI;

	/**
	 * Singleton instance
	 */
	public instance: WasabiS3Provider;

	/**
	 * Current configuration in FileSystem format for core compatibility
	 */
	public config: FileSystem & IWasabiFileStorageProviderConfig;

	private _staticConfig: IWasabiConfig | null = null;
	private _configProvider: IWasabiConfigProvider | null = null;
	private _detailedLoggingEnabled = false;

	constructor(
		@Optional() @Inject(WASABI_CONFIG) staticConfig?: IWasabiConfig,
		@Optional() @Inject(WASABI_CONFIG_PROVIDER) configProvider?: IWasabiConfigProvider
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
	 * @param config - The Wasabi configuration
	 */
	public setConfig(config: IWasabiConfig): void {
		this._staticConfig = config;
		this._refreshConfig();
	}

	/**
	 * Set a dynamic configuration provider.
	 * The provider will be called each time configuration is needed.
	 *
	 * @param provider - The configuration provider
	 */
	public setConfigProvider(provider: IWasabiConfigProvider): void {
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
	 * Get the singleton instance of WasabiS3Provider.
	 * Required by core FileStorage system.
	 *
	 * @returns The provider instance
	 */
	public getProviderInstance(): WasabiS3Provider {
		if (!this.instance) {
			this.instance = this;
		}

		this._refreshConfig();
		return this.instance;
	}

	/**
	 * Get a pre-signed URL for accessing a file.
	 * Required by core Provider interface.
	 *
	 * @param fileKey - The file key/path
	 * @param expiresIn - URL expiration time in seconds (default: 3600)
	 * @returns Pre-signed URL or the original URL if already absolute
	 */
	public async url(fileKey: string, expiresIn: number = 3600): Promise<string | null> {
		if (!fileKey) {
			return null;
		}

		// Return as-is if already an absolute URL
		if (fileKey.startsWith('http://') || fileKey.startsWith('https://')) {
			return fileKey;
		}

		try {
			const s3Client = this._getS3Client();
			if (!s3Client) {
				this._log('error', 'Cannot generate signed URL: S3 client not available');
				return null;
			}

			const signedUrl = await getSignedUrl(
				s3Client,
				new GetObjectCommand({
					Bucket: this.getWasabiBucket(),
					Key: fileKey
				}),
				{ expiresIn }
			);

			return signedUrl;
		} catch (error) {
			this._log('error', 'Error generating signed URL:', error);
			return null;
		}
	}

	/**
	 * Get the full storage path for a file.
	 * Required by core Provider interface.
	 *
	 * @param filePath - The relative file path
	 * @returns Full path with root prefix, or null if empty
	 */
	public path(filePath: string): string | null {
		if (!filePath) {
			return null;
		}

		this._refreshConfig();
		return normalizeFilePath(join(this.config.rootPath || '', filePath));
	}

	/**
	 * Create a Multer storage engine for file uploads.
	 * Required by core Provider interface.
	 *
	 * @param options - File storage options from @gauzy/contracts
	 * @returns Multer storage engine or null if configuration is invalid
	 */
	public handler(options: FileStorageOption): StorageEngine | null {
		const { dest, filename, prefix = 'file' } = options;

		try {
			const s3Client = this._getS3Client();
			if (!s3Client) {
				this._log('error', 'Cannot create Multer handler: S3 client not available');
				return null;
			}

			return multerS3({
				s3: s3Client,
				bucket: (_req, _file, callback) => {
					callback(null, this.getWasabiBucket());
				},
				metadata: (_req, file, callback) => {
					callback(null, { fieldName: file.fieldname });
				},
				key: (_req, file, callback) => {
					// Resolve destination path (can be string or function)
					const destination = typeof dest === 'function' ? (dest as Function)(file) : dest;

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

					// Build full path
					const fullPath = normalizeFilePath(join(destination, generatedFilename));
					callback(null, fullPath);
				}
			});
		} catch (error) {
			this._log('error', 'Error creating Multer handler:', error);
			return null;
		}
	}

	/**
	 * Retrieve file content from Wasabi storage.
	 * Required by core Provider interface.
	 *
	 * @param key - The file key/path
	 * @returns Buffer containing file data, or null on error
	 */
	public async getFile(key: string): Promise<Buffer | null> {
		try {
			const s3Client = this._getS3Client();
			if (!s3Client) {
				this._log('error', 'Cannot get file: S3 client not available');
				return null;
			}

			const command = new GetObjectCommand({
				Bucket: this.getWasabiBucket(),
				Key: key
			});

			const response: GetObjectCommandOutput = await s3Client.send(command);

			// Convert stream to buffer
			if (response.Body) {
				const chunks: Uint8Array[] = [];
				for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
					chunks.push(chunk);
				}
				return Buffer.concat(chunks);
			}

			return null;
		} catch (error) {
			this._log('error', `Error fetching file '${key}':`, error);
			return null;
		}
	}

	/**
	 * Upload file content to Wasabi storage.
	 * Required by core Provider interface.
	 *
	 * @param fileContent - The content to upload
	 * @param key - The destination key/path
	 * @param contentType - Optional MIME type (default: 'application/octet-stream')
	 * @returns Uploaded file information matching @gauzy/contracts UploadedFile
	 */
	public async putFile(
		fileContent: string | Buffer | URL,
		key: string = '',
		contentType: string = 'application/octet-stream'
	): Promise<UploadedFile | null> {
		try {
			const normalizedKey = normalizeFilePath(key);
			const s3Client = this._getS3Client();

			if (!s3Client) {
				this._log('error', 'Cannot upload file: S3 client not available');
				return null;
			}

			const filename = basename(normalizedKey);

			// Upload the file
			const putCommand = new PutObjectCommand({
				Bucket: this.getWasabiBucket(),
				Body: fileContent as any,
				Key: normalizedKey,
				ContentDisposition: `inline; filename="${filename}"`,
				ContentType: contentType
			});

			await s3Client.send(putCommand);

			// Get file metadata
			const headCommand = new HeadObjectCommand({
				Bucket: this.getWasabiBucket(),
				Key: normalizedKey
			});

			const metadata: HeadObjectCommandOutput = await s3Client.send(headCommand);

			const uploadedFile: Partial<UploadedFile> = {
				originalname: filename,
				filename: filename,
				size: metadata.ContentLength,
				path: normalizedKey,
				key: normalizedKey
			};

			return this.mapUploadedFile(uploadedFile);
		} catch (error) {
			this._log('error', 'Error uploading file:', error);
			return null;
		}
	}

	/**
	 * Delete a file from Wasabi storage.
	 * Required by core Provider interface.
	 *
	 * @param key - The file key/path to delete
	 * @throws HttpException if deletion fails
	 */
	public async deleteFile(key: string): Promise<void> {
		try {
			const s3Client = this._getS3Client();
			if (!s3Client) {
				this._log('error', 'Cannot delete file: S3 client not available');
				return;
			}

			const command = new DeleteObjectCommand({
				Bucket: this.getWasabiBucket(),
				Key: key
			});

			const response: DeleteObjectCommandOutput = await s3Client.send(command);
			this._log('info', `File '${key}' deleted successfully`, response);
		} catch (error) {
			this._log('error', `Error deleting file '${key}':`, error);
			throw new HttpException({ message: `Failed to delete file: ${key}`, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Check if a file exists in Wasabi storage.
	 *
	 * @param key - The file key/path
	 * @returns True if the file exists
	 */
	public async fileExists(key: string): Promise<boolean> {
		try {
			const s3Client = this._getS3Client();
			if (!s3Client) {
				return false;
			}

			const command = new HeadObjectCommand({
				Bucket: this.getWasabiBucket(),
				Key: key
			});

			await s3Client.send(command);
			return true;
		} catch (error: any) {
			if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
				return false;
			}
			this._log('error', `Error checking file existence '${key}':`, error);
			return false;
		}
	}

	/**
	 * Get the configured bucket name.
	 *
	 * @returns The bucket name or empty string if not configured
	 */
	public getWasabiBucket(): string {
		this._refreshConfig();
		return this.config.wasabi_aws_bucket || '';
	}

	/**
	 * Map uploaded file to include URL.
	 * Required by core Provider interface.
	 *
	 * @param file - The uploaded file information
	 * @returns Mapped file with URL
	 */
	public async mapUploadedFile(file: Partial<UploadedFile>): Promise<UploadedFile> {
		if (file.key) {
			file.url = await this.url(file.key);
		}
		file.filename = file.originalname;
		return file as UploadedFile;
	}

	// ==================== Private Methods ====================

	/**
	 * Create an empty configuration object matching FileSystem & IWasabiFileStorageProviderConfig
	 */
	private _createEmptyConfig(): FileSystem & IWasabiFileStorageProviderConfig {
		return {
			rootPath: '',
			wasabi_aws_access_key_id: '',
			wasabi_aws_secret_access_key: '',
			wasabi_aws_default_region: DEFAULT_WASABI_REGION,
			wasabi_aws_service_url: DEFAULT_WASABI_SERVICE_URL,
			wasabi_aws_bucket: '',
			wasabi_aws_force_path_style: false
		};
	}

	/**
	 * Refresh configuration from provider or static config.
	 */
	private _refreshConfig(): void {
		// Priority: configProvider > staticConfig > empty
		let rawConfig: IWasabiConfig | null = null;

		if (this._configProvider) {
			rawConfig = this._configProvider.getConfig();
		} else if (this._staticConfig) {
			rawConfig = this._staticConfig;
		}

		if (rawConfig) {
			const { region, serviceUrl } = resolveRegionAndServiceUrl(rawConfig.region, rawConfig.serviceUrl);

			// Map to FileSystem & IWasabiFileStorageProviderConfig format for core compatibility
			this.config = {
				rootPath: rawConfig.rootPath ?? '',
				wasabi_aws_access_key_id: trimIfNotEmpty(rawConfig.accessKeyId) ?? '',
				wasabi_aws_secret_access_key: trimIfNotEmpty(rawConfig.secretAccessKey) ?? '',
				wasabi_aws_default_region: region,
				wasabi_aws_service_url: ensureHttpPrefix(serviceUrl),
				wasabi_aws_bucket: trimIfNotEmpty(rawConfig.bucket) ?? '',
				wasabi_aws_force_path_style: parseToBoolean(rawConfig.forcePathStyle)
			};
		}

		if (this._detailedLoggingEnabled) {
			this._log('debug', 'Configuration refreshed:', {
				...this.config,
				wasabi_aws_secret_access_key: '***'
			});
		}
	}

	/**
	 * Get an S3 client instance.
	 */
	private _getS3Client(): S3Client | null {
		this._refreshConfig();

		const {
			wasabi_aws_access_key_id,
			wasabi_aws_secret_access_key,
			wasabi_aws_default_region,
			wasabi_aws_service_url,
			wasabi_aws_force_path_style
		} = this.config;

		if (!wasabi_aws_access_key_id || !wasabi_aws_secret_access_key || !wasabi_aws_service_url) {
			this._log('warn', 'Incomplete Wasabi configuration - missing credentials or service URL');
			return null;
		}

		try {
			return new S3Client({
				credentials: {
					accessKeyId: wasabi_aws_access_key_id,
					secretAccessKey: wasabi_aws_secret_access_key
				},
				region: wasabi_aws_default_region || DEFAULT_WASABI_REGION,
				endpoint: wasabi_aws_service_url,
				forcePathStyle: wasabi_aws_force_path_style
			});
		} catch (error) {
			this._log('error', 'Error creating S3 client:', error);
			return null;
		}
	}

	/**
	 * Log a message with the specified level.
	 */
	private _log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
		if (!this._detailedLoggingEnabled && level === 'debug') {
			return;
		}

		const prefix = `[WasabiS3Provider]`;
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
