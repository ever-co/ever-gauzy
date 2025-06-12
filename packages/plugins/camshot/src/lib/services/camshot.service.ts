import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FileStorage, tempFile, TenantAwareCrudService } from '@gauzy/core';
import { Camshot } from '../entity/camshot.entity';
import { TypeOrmCamshotRepository } from '../repositories/type-orm-camshot.repository';
import { MikroOrmCamshotRepository } from '../repositories/mikro-orm-camshot.repository';
import { FileDTO } from '../dtos/file.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IPreparedFile } from '../models/prepare.model';
import * as path from 'path';
import * as fs from 'fs';
import * as Jimp from 'jimp';


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
		const fileContent = await provider.getFile(file.key);

		// Create a temporary file for input
		const inputFile = await tempFile('camshot-thumb');

		try {
			// Write the file content to the input temporary file
			await fs.promises.writeFile(inputFile, fileContent);

			// Read and resize the image using Jimp
			const image = await Jimp.read(inputFile);
			image.resize(250, Jimp.AUTO);

			// Get the resized image as a buffer (default to PNG)
			const data = await image.getBufferAsync(Jimp.MIME_PNG);

			// Define thumbnail file name and directory
			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.posix.dirname(file.key); // Use posix for forward slashes
			const fullPath = path.posix.join(thumbDir, thumbName);

			// Upload the thumbnail data to the file storage provider
			return provider.putFile(data, fullPath);
		} catch (error) {
			this.logger.error('Error creating thumbnail:', error);
			throw error;
		} finally {
			// Always remove the temporary input file
			try {
				await fs.promises.unlink(inputFile);
			} catch (unlinkError) {
				this.logger.error('Error while unlinking temp file:', unlinkError);
			}
		}
	}
}
