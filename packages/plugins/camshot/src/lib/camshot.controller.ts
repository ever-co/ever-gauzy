import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BadRequestException, Body, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { Camshot } from './entity/camshot.entity';
import { FileStorage, FileStorageFactory, LazyFileInterceptor, RequestContext, UploadedFileStorage, UseValidationPipe } from '@gauzy/core';
import { CreateCamshotDTO } from './dtos/create-camshot.dto';
import { FileDTO } from './dtos/file.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { CreateCamshotCommand } from './commands/create-camshot.command';

export class CamshotController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) { }

	/**
		 * Create a new camshot record.
		 *
		 * This endpoint allows authorized users to create a new camshot record by providing the necessary metadata.
		 * The camshot file should be uploaded as a form-data file with the key 'file'.
		 *
		 * @param input - The metadata for the camshot record.
		 * @param file - The uploaded camshot file.
		 * @returns A Promise that resolves with the details of the created camshot.
		 */
	@ApiOperation({
		summary: 'Create camshot',
		description: 'This API Endpoint allows uploading the camshot file along with related metadata.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'camshot successfully.',
		type: Camshot
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
	})
	@ApiConsumes('multipart/form-data')
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@UseInterceptors(
		// Use LazyFileInterceptor for handling file uploads with custom storage settings
		LazyFileInterceptor('file', {
			// Define storage settings for uploaded files
			storage: () => FileStorageFactory.create('camshots')
		})
	)
	@Post()
	public async create(@Body() input: CreateCamshotDTO, @UploadedFileStorage() file: FileDTO) {
		// Check if the file key is empty
		if (!file.key) {
			throw new BadRequestException('Camshot file key is empty');
		}
		// Try to create a new camshot record
		try {
			// Create a new camshot record
			return this.commandBus.execute(new CreateCamshotCommand(input, file));
		} catch (error) {
			// Ensure cleanup of uploaded file
			if (file?.key) {
				await new FileStorage().getProvider().deleteFile(file.key);
			}
			// Throw a bad request exception with the validation errors
			throw new BadRequestException(error);
		}
	}
}
