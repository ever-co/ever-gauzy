import { FileStorage } from '@gauzy/core';
import { IFileMetadata, IStorageProvider } from '../../../shared/models/storage-provider.model';
import { FileDTO } from '../../../shared/dto/file.dto';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export class GauzyStorageProvider implements IStorageProvider {
	constructor(private readonly fileStorage: FileStorage) {}

	public async validate(file: FileDTO): Promise<void> {
		const errors = await validate(plainToInstance(FileDTO, file));
		if (errors.length > 0) throw new BadRequestException(errors);
	}

	public async delete(fileKey: string): Promise<void> {
		await this.fileStorage.getProvider().deleteFile(fileKey);
	}

	public extractMetadata(file: FileDTO): IFileMetadata {
		const storageProvider = this.fileStorage.getProvider().name.toUpperCase() as FileStorageProviderEnum;
		return {
			fileName: file.originalname,
			fileSize: file.size,
			filePath: file.path,
			fileKey: file.key,
			storageProvider: storageProvider ?? FileStorageProviderEnum.LOCAL
		};
	}
}
