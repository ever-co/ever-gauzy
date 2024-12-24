import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindOneOptions } from 'typeorm';
import { FileStorageProviderEnum, ID, IDeleteScreenshot, IPagination, IVideo, PermissionsEnum } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	PaginationParams,
	Permissions,
	PermissionGuard,
	UploadedFileStorage,
	TenantPermissionGuard,
	UseValidationPipe,
	RequestContext,
	UUIDValidationPipe,
	LazyFileInterceptor
} from '@gauzy/core';
import { CreateVideoCommand } from './commands/create-video.command';
import { DeleteVideoCommand } from './commands/delete-video.command';
import { GetVideoQuery } from './queries/get-video.query';
import { GetVideosQuery } from './queries/get-videos.query';
import { CreateVideoDTO, DeleteVideoDTO, FileDTO } from './dto';
import { Video } from './entities/video.entity';

@ApiTags('Video Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class VideosController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * GET videos
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all videos.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found videos.',
		type: Video
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	public async findAll(@Query() params: PaginationParams<Video>): Promise<IPagination<IVideo>> {
		return this.queryBus.execute(new GetVideosQuery(params));
	}

	/**
	 * Create a new video record.
	 *
	 * This endpoint allows authorized users to create a new video record by providing the necessary metadata.
	 * The video file should be uploaded as a form-data file with the key 'file'.
	 *
	 * @param input - The metadata for the video record.
	 * @param file - The uploaded video file.
	 * @returns A Promise that resolves with the details of the created video.
	 */
	@Post()
	@ApiOperation({
		summary: 'Create video',
		description: 'This API Endpoint allows uploading the video file along with related metadata.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Video successfully.',
		type: Video
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
			storage: () => FileStorageFactory.create('videos')
		})
	)
	public async create(@Body() input: CreateVideoDTO, @UploadedFileStorage() file: FileDTO) {
		// Get provider
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

		// Extract necessary properties from the request body
		const tenantId = input.tenantId || RequestContext.currentTenantId();
		const organizationId = input.organizationId;
		const uploadedById = input.uploadedById || RequestContext.currentEmployeeId();
		const storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;

		// Create a new video record
		return this.commandBus.execute(
			new CreateVideoCommand({
				...input,
				tenantId,
				organizationId,
				storageProvider,
				uploadedById,
				file
			})
		);
	}

	/**
	 * Retrieves a video record by its ID.
	 * @param id - The UUID of the video to retrieve.2024-12-23T08:00:00.000Z
	 * @param options - Additional query options for finding the video.
	 * @returns A Promise that resolves with the details of the video.
	 *
	 */
	@ApiOperation({ summary: 'Get video by ID' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get(':id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: FindOneOptions<IVideo>
	): Promise<IVideo> {
		return this.queryBus.execute(new GetVideoQuery(id, options));
	}

	/**
	 * Deletes a video record by its ID.
	 *
	 * This endpoint allows authorized users to delete a video record by providing its ID.
	 * Additional query options can be provided to customize the delete operation.
	 *
	 * @param id - The UUID of the video to delete.
	 * @param options - Additional query options for deletion (e.g., soft delete or force delete).
	 * @returns A Promise that resolves with the details of the deleted video.
	 */
	@ApiOperation({
		summary: 'Delete a video by ID',
		description: 'Deletes a video record from the system based on the provided ID.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The video has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Video record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to delete videos.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Delete(':id')
	@UseValidationPipe()
	public async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() options: IDeleteScreenshot): Promise<void> {
		// Convert the plain object to a class instance
		const fileInstance = plainToInstance(DeleteVideoDTO, { id, options });

		// Validate the file DTO
		const errors = await validate(fileInstance);

		// Check for validation errors
		if (errors.length > 0) {
			// Throw a bad request exception with the validation errors
			throw new BadRequestException(errors);
		}

		// Execute the delete video command
		return this.commandBus.execute(new DeleteVideoCommand({ id, options }));
	}
}
