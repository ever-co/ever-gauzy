import { ID, IPagination, ISoundshot, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	FileStorageFactory,
	FindOptionsQueryDTO,
	LazyFileInterceptor,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UploadedFileStorage,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateSoundshotCommand } from './commands/create-soundshot.command';
import { DeleteSoundshotCommand } from './commands/delete-soundshot.command';
import { CountSoundshotDTO } from './dtos/count-soundshot.dto';
import { CreateSoundshotDTO } from './dtos/create-soundshot.dto';
import { DeleteSoundshotDTO } from './dtos/delete-soundshot.dto';
import { FileDTO } from './dtos/file.dto';
import { GetSoundshotsQueryDTO } from './dtos/get-soundshots-query.dto';
import { Soundshot } from './entity/soundshot.entity';
import { GetSoundshotCountQuery } from './queries/get-soundshot-count.query';
import { GetSoundshotQuery } from './queries/get-soundshot.query';
import { GetSoundshotsQuery } from './queries/get-soundshots.query';
import { SoundshotService } from './services/soundshot.service';
import { RecoverSoundshotCommand } from './commands';

@ApiTags('Soundshot Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller('/plugins/soundshots')
export class SoundshotController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly soundshotService: SoundshotService
	) { }

	/**
	 * Get a paginated list of soundshots.
	 *
	 * This endpoint allows authorized users to retrieve a paginated list of soundshots with optional filtering and sorting.
	 * The endpoint supports pagination, filtering, and sorting through the query parameters.
	 *
	 * @param params - Pagination and filtering parameters for soundshots
	 * @returns Promise<IPagination<ISoundshot>> A Promise that resolves with the paginated list of soundshots
	 * @throws {UnauthorizedException} If the user is not authorized to access the soundshots
	 * @throws {ForbiddenException} If the user does not have permission to list soundshots
	 */
	@ApiOperation({
		summary: 'Get paginated list of soundshots',
		description: 'Retrieves a paginated list of soundshots with optional filtering and sorting capabilities.'
	})
	@ApiQuery({
		name: 'params',
		type: BaseQueryDTO<ISoundshot>,
		required: false,
		description:
			'Pagination and filtering parameters for soundshots. Supports filtering by tenant, organization, and other soundshot properties.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Soundshots successfully fetched.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'User is not authorized to access soundshots.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to list soundshots.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get()
	public async list(@Query() params: GetSoundshotsQueryDTO): Promise<IPagination<ISoundshot>> {
		return this.queryBus.execute(new GetSoundshotsQuery(params));
	}

	/**
	 * Create a new soundshot record.
	 *
	 * This endpoint allows authorized users to create a new soundshot record by providing the necessary metadata.
	 * The soundshot file should be uploaded as a form-data file with the key 'file'.
	 *
	 * @param input - The metadata for the soundshot record.
	 * @param file - The uploaded soundshot file.
	 * @returns A Promise that resolves with the details of the created soundshot.
	 */
	@ApiOperation({
		summary: 'Create soundshot',
		description: 'This API Endpoint allows uploading the soundshot file along with related metadata.'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Soundshot created successfully.',
		type: Soundshot
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
			storage: () => FileStorageFactory.create('soundshots')
		})
	)
	@Post()
	public async create(@Body() input: CreateSoundshotDTO, @UploadedFileStorage() file: FileDTO): Promise<ISoundshot> {
		// Check if the file key is empty
		if (!file.key) {
			throw new BadRequestException('Soundshot file key is empty');
		}
		// Try to create a new soundshot record
		try {
			// Create a new soundshot record
			return this.commandBus.execute(new CreateSoundshotCommand(input, file));
		} catch (error) {
			// Ensure cleanup of uploaded file
			if (file?.key && file?.storageProvider) {
				await this.soundshotService.getFileStorageProviderInstance(file.storageProvider).deleteFile(file.key);
			}
			// Throw a bad request exception with the validation errors
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET soundshot count in the same tenant.
	 *
	 * This endpoint retrieves the count of soundshots within a specific tenant.
	 * It takes query parameters to filter the soundshot count by certain criteria.
	 *
	 * @param options Query parameters to filter the soundshot count.
	 * @returns A promise resolving to the total count of soundshots in the tenant.
	 */
	@ApiOperation({ summary: 'Get soundshot count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the soundshot count.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred while retrieving the soundshot count.'
	})
	@Get('count')
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	async getCount(@Query() options: CountSoundshotDTO): Promise<number> {
		return this.queryBus.execute(new GetSoundshotCountQuery(options));
	}

	/**
	 * Retrieves a soundshot record by its ID.
	 *
	 * @param id - The UUID of the soundshot to retrieve.
	 * @param options - Additional query options for finding the soundshot.
	 * @returns A Promise that resolves with the details of the soundshot.
	 */
	@ApiOperation({ summary: 'Get soundshot by ID' })
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
		@Query() options: FindOptionsQueryDTO<ISoundshot>
	): Promise<ISoundshot> {
		return this.queryBus.execute(new GetSoundshotQuery(id, options));
	}

	/**
	 * Recover a soft-deleted soundshot.
	 */
	@ApiOperation({
		summary: 'Recover a deleted soundshot',
		description: 'Soft-recovers a previously deleted soundshot using its UUID and the plugin ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the soundshot to recover',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Soundshot recovered successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Soundshot record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to recover this soundshot.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Patch(':id')
	public async recover(@Param('id', UUIDValidationPipe) id: ID): Promise<ISoundshot> {
		return this.commandBus.execute(new RecoverSoundshotCommand(id));
	}

	/**
	 * Delete a soundshot record.
	 *
	 * This endpoint allows authorized users to delete a soundshot record by providing the necessary ID.
	 *
	 * @param id - The ID of the soundshot to be deleted.
	 * @returns A promise resolving to the result of the deletion operation.
	 */
	@ApiOperation({ summary: 'Delete a soundshot record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Soundshot successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Delete(':id')
	public async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() options: DeleteSoundshotDTO): Promise<void> {
		await this.commandBus.execute(new DeleteSoundshotCommand(id, options));
	}
}
