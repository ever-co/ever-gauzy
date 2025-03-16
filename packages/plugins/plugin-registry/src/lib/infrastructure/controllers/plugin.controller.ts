import { FileStorageProviderEnum, HttpStatus, ID, IPagination, PluginSourceType } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	LazyFileInterceptor,
	PaginationParams,
	RequestContext,
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
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiSecurity,
	ApiTags
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindOneOptions } from 'typeorm';
import { ActivatePluginCommand } from '../../application/commands/activate-plugin.command';
import { CreatePluginCommand } from '../../application/commands/create-plugin.command';
import { DeactivatePluginCommand } from '../../application/commands/deactivate-plugin.command';
import { DeletePluginCommand } from '../../application/commands/delete-plugin.command';
import { UpdatePluginCommand } from '../../application/commands/update-plugin.command';
import { VerifyPluginCommand } from '../../application/commands/verify-plugin.command';
import { GetPluginQuery } from '../../application/queries/get-plugin.query';
import { ListPluginsQuery } from '../../application/queries/list-plugins.query';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { Plugin } from '../../domain/entities/plugin.entity';
import { CreatePluginDTO } from '../../shared/dto/create-plugin.dto';
import { FileDTO } from '../../shared/dto/file.dto';
import { UpdatePluginDTO } from '../../shared/dto/update-plugin.dto';
import { VerifyPluginDTO } from '../../shared/dto/verify-plugin.dto';
import { IPlugin } from '../../shared/models/plugin.model';

/**
 * Controller responsible for managing plugin operations in the system.
 * Provides endpoints for CRUD operations and plugin activation/deactivation.
 */
@ApiTags('Plugin Registry')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@Controller('/plugins')
export class PluginController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Retrieves a paginated list of plugins with optional filtering.
	 */
	@ApiOperation({
		summary: 'List all plugins',
		description: 'Retrieve a paginated list of plugins with optional filtering capabilities.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of plugins retrieved successfully.',
		type: Plugin,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No plugins found matching the provided criteria.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@Get()
	public async findAll(@Query() params: PaginationParams<IPlugin>): Promise<IPagination<IPlugin>> {
		return this.queryBus.execute(new ListPluginsQuery(params));
	}

	/**
	 * Creates a new plugin in the system.
	 */
	@ApiOperation({
		summary: 'Create new plugin',
		description: 'Uploads a plugin file along with metadata to register a new plugin in the system.'
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		type: CreatePluginDTO,
		description: 'Plugin metadata and file'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin created successfully.',
		type: Plugin
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
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
	@UseInterceptors(
		LazyFileInterceptor('file', {
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@Post()
	public async create(@Body() input: CreatePluginDTO, @UploadedFileStorage() file: FileDTO): Promise<IPlugin> {
		if (!file.key && input.source.type === PluginSourceType.GAUZY) {
			console.warn('Plugin file key is empty');
			return;
		}

		try {
			// Extract necessary properties from the request body
			const tenantId = input.tenantId || RequestContext.currentTenantId();
			const organizationId = input.organizationId;
			const uploadedById = input.uploadedById || RequestContext.currentEmployeeId();

			if (input.source.type === PluginSourceType.GAUZY) {
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

				// Create a new plugin record
				return this.commandBus.execute(
					new CreatePluginCommand({
						...input,
						tenantId,
						organizationId,
						uploadedById,
						source: {
							...input.source,
							fileName: file.originalname,
							fileSize: file.size,
							filePath: file.path,
							storageProvider
						}
					})
				);
			} else {
				return this.commandBus.execute(
					new CreatePluginCommand({
						...input,
						tenantId,
						organizationId,
						uploadedById
					})
				);
			}
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
	 * Updates an existing plugin by ID.
	 */
	@ApiOperation({
		summary: 'Update plugin',
		description: 'Updates an existing plugin record based on the provided ID and metadata.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to update',
		required: true
	})
	@ApiBody({
		type: UpdatePluginDTO,
		description: 'Updated plugin metadata'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin updated successfully.',
		type: Plugin
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
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
	@UseGuards(PluginOwnerGuard)
	@Put(':id')
	public async update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdatePluginDTO): Promise<IPlugin> {
		return this.commandBus.execute(new UpdatePluginCommand(id, input));
	}

	/**
	 * Activates a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Activate plugin',
		description: 'Activates a plugin in the system based on the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to activate',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin activated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to activate this plugin.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@UseGuards(PluginOwnerGuard)
	@Patch(':id/activate')
	public async activate(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new ActivatePluginCommand(id));
	}

	/**
	 * Deactivates a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Deactivate plugin',
		description: 'Deactivates a plugin in the system based on the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to deactivate',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin deactivated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to deactivate this plugin.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@UseGuards(PluginOwnerGuard)
	@Patch(':id/deactivate')
	public async deactivate(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new DeactivatePluginCommand(id));
	}

	/**
	 * Verifies a plugin using its ID and verification input.
	 *
	 * @param {string} id - The UUID of the plugin to be verified.
	 * @param {VerifyPluginDTO} input - The verification data required to verify the plugin.
	 * @returns {Promise<void>} A promise that resolves when the verification is complete.
	 *
	 * @throws {BadRequestException} If the input data is invalid.
	 * @throws {NotFoundException} If the plugin is not found.
	 */
	@ApiOperation({
		summary: 'Verify a plugin',
		description: 'Verifies a plugin using its ID and the verification input.'
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Plugin ID in UUID format' })
	@ApiBody({ type: VerifyPluginDTO, description: 'Verification data for the plugin' })
	@ApiResponse({ status: 200, description: 'Plugin verification successful' })
	@ApiResponse({ status: 400, description: 'Bad request - validation failed' })
	@ApiResponse({ status: 404, description: 'Plugin not found' })
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Post(':id/verify')
	public async verify(@Param('id', UUIDValidationPipe) id: ID, @Body() input: VerifyPluginDTO): Promise<boolean> {
		return this.commandBus.execute(new VerifyPluginCommand(id, input));
	}

	/**
	 * Retrieves a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Get plugin by ID',
		description: 'Retrieves detailed information about a specific plugin by its UUID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to retrieve',
		required: true
	})
	@ApiQuery({
		name: 'relations',
		required: false,
		isArray: true,
		description: 'Entity relations to include in the response'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin retrieved successfully.',
		type: Plugin
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
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
	@Get(':id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: FindOneOptions<IPlugin>
	): Promise<IPlugin> {
		return this.queryBus.execute(new GetPluginQuery(id, options));
	}

	/**
	 * Deletes a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Delete plugin',
		description: 'Permanently removes a plugin from the system based on the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to delete',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin deleted successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to delete this plugin.'
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
	@UseGuards(PluginOwnerGuard)
	@Delete(':id')
	public async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new DeletePluginCommand(id));
	}
}
