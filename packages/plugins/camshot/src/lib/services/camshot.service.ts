import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createImageThumbnail, FileStorage, fileContentToBuffer, TenantAwareCrudService, thumbnailFileName } from '@gauzy/core';
import { Camshot } from '../entity/camshot.entity';
import { TypeOrmCamshotRepository } from '../repositories/type-orm-camshot.repository';
import { MikroOrmCamshotRepository } from '../repositories/mikro-orm-camshot.repository';
import { FileDTO } from '../dtos/file.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IPreparedFile } from '../models/prepare.model';
import * as path from 'path';

@Injectable()
export class CamshotService extends TenantAwareCrudService<Camshot> {
	private readonly logger = new Logger(CamshotService.name);
	constructor(
		public readonly typeOrmCamshotRepository: TypeOrmCamshotRepository,
		public readonly mikroOrmCamshotRepository: MikroOrmCamshotRepository
	) {
		super(typeOrmCamshotRepository, mikroOrmCamshotRepository);
	}

	/**
	 * Prepare the file for the camshot service
	 * @param file - The file to prepare
	 * @returns The prepared file
	 */
	public async prepare(file: FileDTO): Promise<IPreparedFile> {
		// Get the file storage provider
		const provider = new FileStorage().getProvider();
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
		// Create the thumbnail
		const thumbnail = await this.createThumbnail(provider, fileInstance);

		return {
			file,
			thumbnail,
			storageProvider: storageProvider ?? FileStorageProviderEnum.LOCAL
		};
	}

	public async createThumbnail(provider: any, file: FileDTO): Promise<FileDTO> {
		// Retrieve file content from the file storage provider
		const fileContent = await fileContentToBuffer(await provider.getFile(file.key));
		if (!fileContent) {
			throw new BadRequestException(`The uploaded camshot '${file.key}' could not be read back from storage`);
		}
		try {
			// 250 px wide, the height following the aspect ratio, as PNG (what the thumbnail always was), oriented as
			// the image displays: sharp (libvips) on its own thread pool. Jimp decoded and resized the full camshot in
			// JavaScript on the event loop, inside the upload request.
			const thumb = await createImageThumbnail(fileContent, { png: true });
			// Define thumbnail file name and directory
			// Named for what the bytes are (PNG), not for the client-supplied extension of the upload
			const thumbName = thumbnailFileName(file.filename, thumb.extension);
			const thumbDir = path.posix.dirname(file.key); // Use posix for forward slashes
			const fullPath = path.posix.join(thumbDir, thumbName);
			// Upload the thumbnail data to the file storage provider
			return provider.putFile(thumb.data, fullPath);
		} catch (error) {
			this.logger.error('Error creating thumbnail:', error);
			throw error;
		}
	}
}
