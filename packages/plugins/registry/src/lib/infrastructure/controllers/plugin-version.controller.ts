import { HttpStatus, ID, IPagination, PluginSourceType } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	FileStorage,
	FileStorageFactory,
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
import { DeletePluginVersionCommand } from '../../application/commands/delete-plugin-version.command';
import { RecoverPluginVersionCommand } from '../../application/commands/recover-plugin-version.command';
import { UpdatePluginVersionCommand } from '../../application/commands/update-plugin-version.command';
import { ListPluginVersionsQuery } from '../../application/queries/list-plugin-versions.query';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { LazyAnyFileInterceptor } from '../../core/interceptors/lazy-any-file.interceptor';
import { PluginVersion } from '../../domain/entities/plugin-version.entity';
import { FileDTO } from '../../shared/dto/file.dto';
import { PluginVersionDTO } from '../../shared/dto/plugin-version.dto';
import { UpdatePluginVersionDTO } from '../../shared/dto/update-plugin-version.dto';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { GauzyStorageProvider } from '../storage/providers/gauzy-storage.provider';
import { UploadedPluginStorage } from '../storage/uploaded-plugin.storage';

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
		LazyAnyFileInterceptor({
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@UseGuards(PluginOwnerGuard)
	@Post()
	public async createVersion(
		@Param('pluginId', UUIDValidationPipe) id: ID,
		@Body() input: PluginVersionDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPluginVersion> {
		try {
			// Validate files against sources
			this.validateFilesAgainstSources(input.sources, files);
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
			// Process each source
			const sources = await Promise.all(
				input.sources.map(async (source) => {
					if (source.type === PluginSourceType.GAUZY) {
						// Find matching file for this source
						const file = this.findFileForSource(files, source as IPluginSource);
						if (!file?.key) {
							throw new BadRequestException(`Plugin file key is empty for source: ${source.name}`);
						}
						// Validate and extract metadata
						await gauzyStorageProvider.validate(file);
						const metadata = gauzyStorageProvider.extractMetadata(file);
						return {
							...source,
							...metadata
						};
					} else {
						return source;
					}
				})
			);
			return this.commandBus.execute(
				new CreatePluginVersionCommand(id, {
					...input,
					sources
				})
			);
		} catch (error) {
			// Cleanup any uploaded files if error occurs
			if (files?.length > 0) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				await Promise.all(
					files.map((file) => (file?.key ? gauzyStorageProvider.delete(file.key) : Promise.resolve()))
				);
			}
			// Improved error handling
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(error.response?.message || error.message || 'Failed to create plugin');
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
		LazyAnyFileInterceptor({
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@UseGuards(PluginOwnerGuard)
	@Put(':versionId')
	public async update(
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body() input: UpdatePluginVersionDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPluginVersion> {
		try {
			// Validate files against sources
			this.validateFilesAgainstSources(input.sources as IPluginSource[], files);
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
			// Process each source
			const sources = await Promise.all(
				input.sources.map(async (source) => {
					if (source.type === PluginSourceType.GAUZY) {
						// Find matching file for this source
						const file = this.findFileForSource(files, source as IPluginSource);
						if (!file?.key) {
							throw new BadRequestException(`Plugin file key is empty for source: ${source.name}`);
						}
						// Validate and extract metadata
						await gauzyStorageProvider.validate(file);
						const metadata = gauzyStorageProvider.extractMetadata(file);
						return {
							...source,
							...metadata
						};
					} else {
						return source;
					}
				})
			);
			return this.commandBus.execute(new UpdatePluginVersionCommand(pluginId, versionId, { ...input, sources }));
		} catch (error) {
			// Cleanup any uploaded files if error occurs
			if (files?.length > 0) {
				const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
				await Promise.all(
					files.map((file) => (file?.key ? gauzyStorageProvider.delete(file.key) : Promise.resolve()))
				);
			}
			// Improved error handling
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(error.response?.message || error.message || 'Failed to create plugin');
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

	private validateFilesAgainstSources(sources: IPluginSource[], files: FileDTO[]): void {
		const gauzySources = sources.filter((s) => s.type === PluginSourceType.GAUZY);

		// Check file count matches GAUZY sources count
		if (gauzySources.length > 0 && (!files || files.length < gauzySources.length)) {
			throw new BadRequestException(
				`Expected ${gauzySources.length} files for GAUZY sources, got ${files?.length || 0}`
			);
		}
	}

	/**
	 * Find the appropriate file for a given source
	 */
	private findFileForSource(files: FileDTO[], source: IPluginSource): FileDTO | undefined {
		// This could be based on filename, metadata, or other criteria
		return files.find((file) => file.originalname.includes(source.fileName));
	}
}
