import { ICamshot, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	FileStorage,
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
import { CreateCamshotCommand } from './commands/create-camshot.command';
import { DeleteCamshotCommand } from './commands/delete-camshot.command';
import { CountCamshotDTO } from './dtos/count-camshot.dto';
import { CreateCamshotDTO } from './dtos/create-camshot.dto';
import { DeleteCamshotDTO } from './dtos/delete-camshot.dto';
import { FileDTO } from './dtos/file.dto';
import { Camshot } from './entity/camshot.entity';
import { ListCamshotQuery } from './queries';
import { GetCamshotCountQuery } from './queries/get-camshot-count.query';
import { GetCamshotQuery } from './queries/get-camshot.query';
import { RecoverCamshotCommand } from './commands';

@ApiTags('Camshot Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller('/plugins/camshots')
export class CamshotController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) { }

	/**
	 * Get a paginated list of camshots.
	 *
	 * This endpoint allows authorized users to retrieve a paginated list of camshots with optional filtering and sorting.
	 * The endpoint supports pagination, filtering, and sorting through the query parameters.
	 *
	 * @param params - Pagination and filtering parameters for camshots
	 * @returns Promise<IPagination<ICamshot>> A Promise that resolves with the paginated list of camshots
	 * @throws {UnauthorizedException} If the user is not authorized to access the camshots
	 * @throws {ForbiddenException} If the user does not have permission to list camshots
	 */
	@ApiOperation({
		summary: 'Get paginated list of camshots',
		description: 'Retrieves a paginated list of camshots with optional filtering and sorting capabilities.'
	})
	@ApiQuery({
		name: 'params',
		type: BaseQueryDTO<ICamshot>,
		required: false,
		description:
			'Pagination and filtering parameters for camshots. Supports filtering by tenant, organization, and other camshot properties.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Camshots successfully fetched.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'User is not authorized to access camshots.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to list camshots.'
	})
	@Get()
	public async list(@Query() params: BaseQueryDTO<ICamshot>): Promise<IPagination<ICamshot>> {
		return this.queryBus.execute(new ListCamshotQuery(params));
	}

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
		status: HttpStatus.CREATED,
		description: 'Camshot created successfully.',
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
	public async create(@Body() input: CreateCamshotDTO, @UploadedFileStorage() file: FileDTO): Promise<ICamshot> {
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

	/**
	 * GET camshot count in the same tenant.
	 *
	 * This endpoint retrieves the count of camshots within a specific tenant.
	 * It takes query parameters to filter the camshot count by certain criteria.
	 *
	 * @param options Query parameters to filter the camshot count.
	 * @returns A promise resolving to the total count of camshots in the tenant.
	 */
	@ApiOperation({ summary: 'Get camshot count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the camshot count.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred while retrieving the camshot count.'
	})
	@Get('count')
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	async getCount(@Query() options: CountCamshotDTO): Promise<number> {
		return this.queryBus.execute(new GetCamshotCountQuery(options));
	}

	/**
	 * Retrieves a camshot record by its ID.
	 *
	 * @param id - The UUID of the camshot to retrieve.
	 * @param options - Additional query options for finding the camshot.
	 * @returns A Promise that resolves with the details of the camshot.
	 */
	@ApiOperation({ summary: 'Get camshot by ID' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Camshot successfully fetched by ID.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Camshot with the given ID not found.'
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred while retrieving the camshot.'
	})
	@ApiQuery({ name: 'options', type: FindOptionsQueryDTO, required: false })
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get(':id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: FindOptionsQueryDTO<ICamshot>
	): Promise<ICamshot> {
		return this.queryBus.execute(new GetCamshotQuery(id, options));
	}

	/**
	 * Recover a soft-deleted plugin source.
	 */
	@ApiOperation({
		summary: 'Recover a deleted camshot',
		description: 'Soft-recovers a previously deleted camshot using its UUID, version UUID the plugin ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the camshot to recover',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Camshot recovered successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Camshot record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to recover this camshot.'
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
	public async recover(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new RecoverCamshotCommand(id));
	}

	/**
	 * Delete a camshot record.
	 *
	 * This endpoint allows authorized users to delete a camshot record by providing the necessary ID.
	 *
	 * @param id - The ID of the camshot to be deleted.
	 * @returns A promise resolving to the result of the deletion operation.
	 */
	@ApiOperation({ summary: 'Delete a camshot record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Camshot successfully deleted.'
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
	public async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() options: DeleteCamshotDTO): Promise<void> {
		await this.commandBus.execute(new DeleteCamshotCommand(id, options));
	}
}
