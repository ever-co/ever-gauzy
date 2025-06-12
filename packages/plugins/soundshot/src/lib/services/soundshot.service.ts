import { BadRequestException, Injectable } from '@nestjs/common';
import { FileStorage, TenantAwareCrudService } from '@gauzy/core';
import { Soundshot } from '../entity/soundshot.entity';
import { TypeOrmSoundshotRepository } from '../repositories/type-orm-soundshot.repository';
import { MikroOrmSoundshotRepository } from '../repositories/mikro-orm-soundshot.repository';
import { FileDTO } from '../dtos/file.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IPreparedFile } from '../models/prepare.model';

@Injectable()
export class SoundshotService extends TenantAwareCrudService<Soundshot> {
	private readonly fileStorage: FileStorage;

	constructor(
		public readonly typeOrmSoundshotRepository: TypeOrmSoundshotRepository,
		public readonly mikroOrmSoundshotRepository: MikroOrmSoundshotRepository
	) {
		super(typeOrmSoundshotRepository, mikroOrmSoundshotRepository);
		this.fileStorage = new FileStorage();
	}

	/**
	 * Prepare the file for the soundshot service
	 * @param file - The file to prepare
	 * @returns The prepared file
	 */
	public async prepare(file: FileDTO): Promise<IPreparedFile> {
		// Get the file storage provider
		const provider = this.fileStorage.getProvider();
		// Convert the plain object to a class instance
		const fileInstance = plainToInstance(FileDTO, file);
		// Validate the file DTO
		const errors = await validate(fileInstance);

		// Check for validation errors
		if (errors.length > 0) {
			// Delete the uploaded file if validation fails
			await provider.deleteFile(file.key);
			// Throw a bad request exception with the validation errors
			throw new BadRequestException(errors);
		}

		let storageProvider: FileStorageProviderEnum;
		const providerName = provider.name?.toUpperCase();
		if (providerName && Object.values(FileStorageProviderEnum).includes(providerName as FileStorageProviderEnum)) {
			storageProvider = providerName as FileStorageProviderEnum;
		} else {
			storageProvider = FileStorageProviderEnum.LOCAL;
		}

		return {
			file,
			storageProvider
		};
	}

	public getFileStorageProviderInstance(storageProviderEnum?: FileStorageProviderEnum) {
		if (storageProviderEnum) {
			return this.fileStorage.setProvider(storageProviderEnum).getProviderInstance();
		} else {
			return this.fileStorage.getProvider();
		}
	}
}
