import { StorageEngine } from 'multer';
import { FileStorageOption, FileStorageProvider, FileSystem, UploadedFile } from '@gauzy/contracts';

/**
 * Abstract base class for file storage providers.
 * This class matches the core Provider interface from @gauzy/core for compatibility.
 *
 * All storage providers must extend this class to work with the FileStorage system.
 *
 * @template T - The concrete provider type for type-safe instance methods
 */
export abstract class Provider<T> {
	/**
	 * Singleton instance of the provider
	 */
	public abstract instance: T | undefined;

	/**
	 * Unique name identifier for the provider.
	 * Must match a value from FileStorageProviderEnum.
	 */
	public abstract readonly name: FileStorageProvider;

	/**
	 * Current configuration for the provider.
	 * Extends FileSystem with provider-specific settings.
	 */
	public abstract config: FileSystem;

	constructor() {}

	/**
	 * Get a URL for accessing a file.
	 * For cloud storage, this typically returns a pre-signed URL.
	 *
	 * @param filePath - The path or key of the file
	 * @returns Promise resolving to the URL or null if not available
	 */
	abstract url(filePath: string): Promise<string | null>;

	/**
	 * Get the full storage path for a file.
	 *
	 * @param filePath - The relative file path
	 * @returns The full path including any configured root path
	 */
	abstract path(filePath: string): string | null;

	/**
	 * Get a Multer storage engine configured for this provider.
	 *
	 * @param options - File storage options for upload handling
	 * @returns A Multer StorageEngine instance
	 */
	abstract handler(options: FileStorageOption): StorageEngine | null;

	/**
	 * Retrieve file content from storage.
	 *
	 * @param filePath - The path or key of the file
	 * @returns Promise resolving to a Buffer containing file data
	 */
	abstract getFile(filePath: string): Promise<Buffer | null>;

	/**
	 * Upload file content to storage.
	 *
	 * @param fileContent - The content to upload (string, Buffer, or URL)
	 * @param destinationPath - The destination path/key for the file
	 * @returns Promise resolving to uploaded file information
	 */
	abstract putFile(fileContent: string | Buffer | URL, destinationPath?: string): Promise<UploadedFile | null>;

	/**
	 * Delete a file from storage.
	 *
	 * @param filePath - The path or key of the file to delete
	 * @returns Promise that resolves when deletion is complete
	 */
	abstract deleteFile(filePath: string): Promise<void>;

	/**
	 * Get a singleton instance of the provider.
	 *
	 * @returns The provider instance
	 */
	abstract getProviderInstance(): T;

	/**
	 * Map uploaded file information to a standardized format.
	 * Override this method to add provider-specific transformations.
	 *
	 * @param uploadedFile - The uploaded file information
	 * @returns Promise resolving to the mapped file information
	 */
	async mapUploadedFile(uploadedFile: Partial<UploadedFile>): Promise<UploadedFile> {
		return uploadedFile as UploadedFile;
	}
}
