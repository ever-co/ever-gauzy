import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileDTO } from '../dto/file.dto';

export interface IFileMetadata {
	fileName: string;
	fileSize: number;
	filePath: string;
	fileKey: string;
	storageProvider: FileStorageProviderEnum;
}

export interface IStorageProvider {
	validate(file: FileDTO): Promise<void>;
	delete(fileKey: string): Promise<void>;
	extractMetadata(file: FileDTO): IFileMetadata;
}
