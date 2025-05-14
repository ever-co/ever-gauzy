import { HttpStatus, ID, IPagination, PluginSourceType } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	LazyFileInterceptor,
	BaseQueryDTO,
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
	Get,
	Param,
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
	ApiResponse,
	ApiSecurity,
	ApiTags
} from '@nestjs/swagger';
import { CreatePluginVersionCommand } from '../../application/commands/create-plugin-version.command';
import { ListPluginVersionsQuery } from '../../application/queries/list-plugin-versions.query';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { FileDTO } from '../../shared/dto/file.dto';
import { PluginVersionDTO } from '../../shared/dto/plugin-version.dto';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { PluginFactory } from '../../shared/utils/plugin-factory.util';
import { GauzyStorageProvider } from '../storage/providers/gauzy-storage.provider';
import { UploadedPluginStorage } from '../storage/uploaded-plugin.storage';
import { DeletePluginVersionCommand } from '../../application/commands/delete-plugin-version.command';
import { RecoverPluginVersionCommand } from '../../application/commands/recover-plugin-version.command';
import { UpdatePluginVersionDTO } from '../../shared/dto/update-plugin-version.dto';
import { UpdatePluginVersionCommand } from '../../application/commands/update-plugin-version.command';
import { PluginVersion } from '../../domain/entities/plugin-version.entity';

@ApiTags('Plugin Versions')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId/versions')
export class PluginVersionController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({ summary: 'List all plugin versions' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of plugin versions retrieved successfully.',
		type: PluginVersionDTO,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No plugin versions found matching the provided criteria.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@Get()
	public async findAllVersions(
		@Param('pluginId', UUIDValidationPipe) id: ID,
		@Query() params: BaseQueryDTO<IPluginVersion>
	): Promise<IPagination<IPluginVersion>> {
		return this.queryBus.execute(new ListPluginVersionsQuery(id, params));
	}

	@ApiOperation({ summary: 'Create a new plugin version' })
	@ApiParam({
		name: 'pluginId',
		type: 'string',
		format: 'uuid',
		description: 'The UUID of the plugin for which a new version is being created.'
	})
	@ApiBody({ type: PluginVersionDTO, description: 'The data required to create a new plugin version.' })
	@ApiResponse({ status: 201, description: 'Plugin version successfully created.', type: PluginVersionDTO })
	@ApiResponse({ status: 400, description: 'Bad request - Validation failed.' })
	@ApiResponse({ status: 404, description: 'Plugin not found.' })
	@ApiConsumes('multipart/form-data')
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@UseInterceptors(
		LazyFileInterceptor('file', {
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@UseGuards(PluginOwnerGuard)
	@Post()
	public async createVersion(
		@Param('pluginId', UUIDValidationPipe) id: ID,
		@Body() input: PluginVersionDTO,
		@UploadedPluginStorage() file: FileDTO
	): Promise<IPluginVersion> {
		if (input.source.type === PluginSourceType.GAUZY && !file?.key) {
			throw new BadRequestException('Plugin file key is empty');
		}

		try {
			const dto = PluginFactory.createVersion(input);

			if (input.source.type === PluginSourceType.GAUZY) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				// Convert the plain object to a class instance
				await gauzyStorageProvider.validate(file);
				// Get metadata
				const metadata = gauzyStorageProvider.extractMetadata(file);
				// Create a new plugin version record
				return this.commandBus.execute(
					new CreatePluginVersionCommand(id, {
						...dto,
						source: {
							...dto.source,
							...metadata
						}
					})
				);
			} else {
				return this.commandBus.execute(new CreatePluginVersionCommand(id, dto));
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
	 * Updates an existing plugin version by IDs.
	 */
	@ApiOperation({
		summary: 'Update plugin version',
		description: 'Updates an existing plugin version record based on the provided ID and metadata.'
	})
	@ApiParam({
		name: 'versionId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin version to update',
		required: true
	})
	@ApiBody({
		type: UpdatePluginVersionDTO,
		description: 'Updated plugin version data transfer object'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin version updated successfully.',
		type: PluginVersion
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin version record not found.'
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
	@Put(':versionId')
	public async update(
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body() input: UpdatePluginVersionDTO,
		@UploadedPluginStorage() file: FileDTO
	): Promise<IPluginVersion> {
		try {
			if (input.source.type === PluginSourceType.GAUZY) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				// Convert the plain object to a class instance
				await gauzyStorageProvider.validate(file);
				// Get metadata
				const metadata = gauzyStorageProvider.extractMetadata(file);

				// Create a new plugin record
				return this.commandBus.execute(
					new UpdatePluginVersionCommand(pluginId, versionId, {
						...input,
						source: {
							...input.source,
							...metadata
						}
					})
				);
			} else {
				return this.commandBus.execute(new UpdatePluginVersionCommand(pluginId, versionId, input));
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
	 * Recover a soft-deleted plugin version.
	 */
	@ApiOperation({
		summary: 'Recover a deleted plugin version',
		description: 'Soft-recovers a previously deleted plugin version using its UUID and the plugin ID.'
	})
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to which the version belongs',
		required: true
	})
	@ApiParam({
		name: 'versionId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin version to recover',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin version recovered successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin version record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to recover this plugin version.'
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
	@Post(':versionId')
	public async recover(
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID
	): Promise<void> {
		return this.commandBus.execute(new RecoverPluginVersionCommand(versionId, pluginId));
	}

	/**
	 * Deletes a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Delete plugin',
		description: 'Soft removes a plugin version from the system based on the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin version to delete',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin version deleted successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin version record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to delete this plugin version.'
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
	@Delete(':versionId')
	public async delete(
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID
	): Promise<void> {
		return this.commandBus.execute(new DeletePluginVersionCommand(versionId, pluginId));
	}
}
