import { HttpStatus, ID, PluginSourceType } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	LazyFileInterceptor,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Param,
	Post,
	Put,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiSecurity,
	ApiTags
} from '@nestjs/swagger';
import { CreatePluginCommand } from '../../application/commands/create-plugin.command';
import { DeletePluginCommand } from '../../application/commands/delete-plugin.command';
import { UpdatePluginCommand } from '../../application/commands/update-plugin.command';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { Plugin } from '../../domain/entities/plugin.entity';
import { CreatePluginDTO } from '../../shared/dto/create-plugin.dto';
import { FileDTO } from '../../shared/dto/file.dto';
import { UpdatePluginDTO } from '../../shared/dto/update-plugin.dto';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginFactory } from '../../shared/utils/plugin-factory.util';
import { GauzyStorageProvider } from '../storage/providers/gauzy-storage.provider';
import { UploadedPluginStorage } from '../storage/uploaded-plugin.storage';

@ApiTags('Plugin Management')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins')
export class PluginManagementController {
	constructor(private readonly commandBus: CommandBus) {}

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
	public async create(@Body() input: CreatePluginDTO, @UploadedPluginStorage() file: FileDTO): Promise<IPlugin> {
		if (input.version.source.type === PluginSourceType.GAUZY && !file?.key) {
			throw new BadRequestException('Plugin file key is empty');
		}

		try {
			const dto = PluginFactory.create(input);

			if (input.version.source.type === PluginSourceType.GAUZY) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				// Convert the plain object to a class instance
				await gauzyStorageProvider.validate(file);
				// Get metadata
				const metadata = gauzyStorageProvider.extractMetadata(file);

				// Create a new plugin record
				return this.commandBus.execute(
					new CreatePluginCommand({
						...dto,
						version: {
							...dto.version,
							source: {
								...dto.version.source,
								...metadata
							}
						}
					})
				);
			} else {
				return this.commandBus.execute(new CreatePluginCommand(dto));
			}
		} catch (error) {
			// Ensure cleanup of uploaded file
			if (file?.key) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				await gauzyStorageProvider.delete(file.key);
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
	@ApiConsumes('multipart/form-data')
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
	@UseGuards(PluginOwnerGuard)
	@Put(':id')
	public async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdatePluginDTO,
		@UploadedPluginStorage() file: FileDTO
	): Promise<IPlugin> {
		try {
			if (input.version.source.type === PluginSourceType.GAUZY) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				// Convert the plain object to a class instance
				await gauzyStorageProvider.validate(file);
				// Get metadata
				const metadata = gauzyStorageProvider.extractMetadata(file);

				// Create a new plugin record
				return this.commandBus.execute(
					new UpdatePluginCommand(id, {
						...input,
						version: {
							...input.version,
							source: {
								...input.version.source,
								...metadata
							}
						}
					})
				);
			} else {
				return this.commandBus.execute(new UpdatePluginCommand(id, input));
			}
		} catch (error) {
			// Ensure cleanup of uploaded file
			if (file?.key) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				await gauzyStorageProvider.delete(file.key);
			}

			// Throw a bad request exception with the validation errors
			throw new BadRequestException(error);
		}
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
