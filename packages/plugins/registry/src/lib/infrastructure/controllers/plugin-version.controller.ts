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
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CreatePluginVersionCommand,
	DeletePluginVersionCommand,
	ListPluginVersionsQuery,
	RecoverPluginVersionCommand,
	UpdatePluginVersionCommand
} from '../../application';
import { LazyAnyFileInterceptor, PluginOwnerGuard } from '../../core';
import { PluginVersion } from '../../domain';
import { FileDTO, IPluginSource, IPluginVersion, PluginVersionDTO, UpdatePluginVersionDTO } from '../../shared';
import { GauzyStorageProvider, UploadedPluginStorage } from '../storage';

@ApiTags('Plugin Versions')
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
	@UseGuards(PluginOwnerGuard, TenantPermissionGuard, PermissionGuard)
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
	@UseGuards(PluginOwnerGuard, TenantPermissionGuard, PermissionGuard)
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
	 * Update plugin version status (including restoration)
	 */
	@ApiOperation({
		summary: 'Update plugin version status',
		description: 'Updates a plugin version status, including restoring deleted versions.'
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
		description: 'UUID of the plugin version to update',
		required: true
	})
	@ApiBody({
		description: 'Status update data',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['active', 'inactive', 'deleted', 'restored'],
					description: 'The new status for the plugin version'
				}
			},
			required: ['status']
		}
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin version status updated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin version record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to update this plugin version.'
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
	@UseGuards(PluginOwnerGuard, TenantPermissionGuard, PermissionGuard)
	@Patch(':versionId/status')
	public async updateStatus(
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body() updateDto: { status: 'active' | 'inactive' | 'deleted' | 'restored' }
	): Promise<void> {
		if (updateDto.status === 'restored') {
			return this.commandBus.execute(new RecoverPluginVersionCommand(versionId, pluginId));
		}

		// Handle other status updates as needed
		// Note: Implement appropriate command handling for other statuses
		throw new Error(`Status '${updateDto.status}' update not implemented yet`);
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
	@UseGuards(PluginOwnerGuard, TenantPermissionGuard, PermissionGuard)
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
