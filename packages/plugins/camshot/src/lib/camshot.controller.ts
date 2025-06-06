import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Get, HttpStatus, Query, UseInterceptors, UseGuards, Post } from '@nestjs/common';
import { Camshot } from './entity/camshot.entity';
import { BaseQueryDTO, FileStorage, FileStorageFactory, LazyFileInterceptor, TenantPermissionGuard, PermissionGuard, UploadedFileStorage, UseValidationPipe, Permissions } from '@gauzy/core';
import { CreateCamshotDTO } from './dtos/create-camshot.dto';
import { FileDTO } from './dtos/file.dto';
import { ICamshot, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CreateCamshotCommand } from './commands/create-camshot.command';
import { ListCamshotQuery } from './queries';

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
		description: 'Pagination and filtering parameters for camshots. Supports filtering by tenant, organization, and other camshot properties.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Camshots successfully fetched.',
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
