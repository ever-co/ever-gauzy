import { BadRequestException, Injectable } from '@nestjs/common';
import { FileStorage, RequestContext, tempFile, TenantAwareCrudService } from '@gauzy/core';
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
	constructor(
		public readonly typeOrmVideoRepository: TypeOrmCamshotRepository,
		public readonly mikroOrmVideoRepository: MikroOrmCamshotRepository
	) {
		super(typeOrmVideoRepository, mikroOrmVideoRepository);
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

		const storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;
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

		// Create temporary files for input and output of thumbnail processing
		const inputFile = await tempFile('camshot-thumb');
		const outputFile = await tempFile('camshot-thumb');

		// Write the file content to the input temporary file
		await fs.promises.writeFile(inputFile, fileContent);

		// Resize the image using Jimp library
		const image = await Jimp.read(inputFile);

		// we are using Jimp.AUTO for height instead of hardcode (e.g. 150px)
		image.resize(250, Jimp.AUTO);

		// Write the resized image to the output temporary file
		await image.writeAsync(outputFile);

		// Read the resized image data from the output temporary file
		const data = await fs.promises.readFile(outputFile);

		try {
			// Remove the temporary input and output files
			await fs.promises.unlink(inputFile);
			await fs.promises.unlink(outputFile);
		} catch (error) {
			console.error('Error while unlinking temp files:', error);
		}

		// Define thumbnail file name and directory
		const thumbName = `thumb-${file.filename}`;
		const thumbDir = path.dirname(file.key);

		// Replace double backslashes with single forward slashes
		const fullPath = path.join(thumbDir, thumbName).replace(/\\/g, '/');

		// Upload the thumbnail data to the file storage provider
		return provider.putFile(data, fullPath);
	}
}
