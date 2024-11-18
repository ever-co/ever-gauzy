import { StorageEngine } from 'multer';
import { FileStorageOption, FileStorageProvider, FileSystem, UploadedFile } from '@gauzy/contracts';

export abstract class Provider<T> {

	public abstract instance: any | undefined;
	public abstract readonly name: FileStorageProvider;
	public abstract config: FileSystem;

	constructor() { }

	/**
	 * Get the URL for a given file path.
	 * @param filePath The path of the file.
	 */
	abstract url(filePath: string): Promise<string | null>;

	/**
	 * Get the local file path for a given file path.
	 * @param filePath The path of the file.
	 */
	abstract path(filePath: string): string;

	/**
	 * Get the Multer storage engine handler for file upload.
	 * @param options The file storage options.
	 */
	abstract handler(options: FileStorageOption): StorageEngine;

	/**
	 * Get the content of a file as a Buffer.
	 * @param filePath The path of the file.
	 */
	abstract getFile(filePath: string): Promise<Buffer>;

	/**
	 * Upload a file to the storage provider.
	 * @param fileContent The content of the file as a string, Buffer, or URL.
	 * @param destinationPath (Optional) The destination path for the file.
	 */
	abstract putFile(fileContent: string | Buffer | URL, destinationPath?: string): Promise<UploadedFile>;

	/**
	 * Delete a file from the storage provider.
	 * @param filePath The path of the file to be deleted.
	 */
	abstract deleteFile(filePath: string): Promise<void>;

	/**
	 * Get an instance of the storage provider.
	 */
	abstract getProviderInstance(): T;

	/**
	 * Map the uploaded file information.
	 * @param uploadedFile The uploaded file information.
	 */
	async mapUploadedFile(uploadedFile: UploadedFile): Promise<UploadedFile> {
		return uploadedFile;
	}
}
