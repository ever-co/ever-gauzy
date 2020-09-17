import { StorageEngine } from 'multer';
import { FileStorageOption, FileSystem, UploadedFile } from '../models';

export abstract class Provider {
	static instance: any;
	tenantId?: string;
	abstract name: string;
	abstract config: FileSystem;

	constructor() {}

	abstract url(path: string): string;
	abstract path(path: string): string;
	abstract handler(options: FileStorageOption): StorageEngine;
	abstract getFile(file: string, buffer?: boolean): Promise<string>;
	abstract putFile(fileContent: string, path?: string): Promise<UploadedFile>;
	abstract getInstance(): Provider;

	mapUploadedFile(file): UploadedFile {
		return file;
	}
}
