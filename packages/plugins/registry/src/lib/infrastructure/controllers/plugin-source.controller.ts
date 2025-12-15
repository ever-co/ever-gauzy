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
	Query,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CreatePluginSourceCommand,
	DeletePluginSourceCommand,
	ListPluginSourcesQuery,
	RecoverPluginSourceCommand
} from '../../application';
import { LazyAnyFileInterceptor, PluginOwnerGuard } from '../../core';
import { CreatePluginSourceDTO, FileDTO, IPluginSource, IPluginVersion, PluginSourceDTO } from '../../shared';
import { GauzyStorageProvider, UploadedPluginStorage } from '../storage';

@ApiTags('Plugin Sources')
@Controller('/plugins/:pluginId/versions/:versionId/sources')
export class PluginSourceController {
	constructor(private readonly queryBus: QueryBus, private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'List all plugin sources' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of plugin sources retrieved successfully.',
		type: PluginSourceDTO,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No plugin sources found matching the provided criteria.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@Get()
	public async findAllSources(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Query() params: BaseQueryDTO<IPluginVersion>
	): Promise<IPagination<IPluginVersion>> {
		return this.queryBus.execute(new ListPluginSourcesQuery(pluginId, versionId, params));
	}

	@ApiOperation({ summary: 'Create a new plugin source' })
	@ApiParam({
		name: 'pluginId',
		type: 'string',
		format: 'uuid',
		description: 'The UUID of the plugin for which a new version is being associated to.'
	})
	@ApiParam({
		name: 'versionId',
		type: 'string',
		format: 'uuid',
		description: 'The UUID of the version for which a new source is being created.'
	})
	@ApiBody({ type: CreatePluginSourceDTO, description: 'The data required to create a new plugin source.' })
	@ApiResponse({ status: 201, description: 'Plugin source successfully created.', type: [PluginSourceDTO] })
	@ApiResponse({ status: 400, description: 'Bad request - Validation failed.' })
	@ApiResponse({ status: 404, description: 'Version not found.' })
	@ApiConsumes('multipart/form-data')
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@UseInterceptors(
		LazyAnyFileInterceptor({
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@UseGuards(PluginOwnerGuard, TenantPermissionGuard, PermissionGuard)
	@Post()
	public async create(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Body() input: CreatePluginSourceDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPluginSource[]> {
		try {
			// Validate files against sources
			this.validateFilesAgainstSources(input.sources, files);
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
			// Process each source
			const sources = await Promise.all(
				input.sources.map(async (source: IPluginSource) => {
					if (source.type === PluginSourceType.GAUZY) {
						// Find matching file for this source
						const file = this.findFileForSource(files, source as IPluginSource);
						if (!file?.key) {
							throw new BadRequestException(`Plugin file key is empty for source: ${source.type}`);
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
			return this.commandBus.execute(new CreatePluginSourceCommand(pluginId, versionId, sources));
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
	 * Validate that files match the required sources
	 */
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
		// Implement your matching logic here
		// This could be based on filename, metadata, or other criteria
		return files.find((file) => file.originalname.includes(source.fileName));
	}

	/**
	 * Deletes a plugin source by ID.
	 */
	@ApiOperation({
		summary: 'Delete plugin source',
		description: 'Soft removes a plugin source from the system based on the provided ID.'
	})
	@ApiParam({
		name: 'sourceId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin source to delete',
		required: true
	})
	@ApiParam({
		name: 'versionId',
		type: String,
		format: 'uuid',
		description: 'UUID of the associated plugin version to delete',
		required: true
	})
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: 'UUID of the associated plugin to delete',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin source deleted successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin source record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to delete this plugin source.'
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
	@Delete(':sourceId')
	public async delete(
		@Param('sourceId', UUIDValidationPipe) sourceId: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID
	): Promise<void> {
		return this.commandBus.execute(new DeletePluginSourceCommand(sourceId, versionId, pluginId));
	}

	/**
	 * Update plugin source status (including restoration)
	 */
	@ApiOperation({
		summary: 'Update plugin source status',
		description: 'Updates a plugin source status, including restoring deleted sources.'
	})
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: "UUID of the plugin to which the source's version belongs",
		required: true
	})
	@ApiParam({
		name: 'versionId',
		type: String,
		format: 'uuid',
		description: "UUID of the plugin source's version",
		required: true
	})
	@ApiParam({
		name: 'sourceId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin source to update',
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
					description: 'The new status for the plugin source'
				}
			},
			required: ['status']
		}
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin source status updated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin source record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to update this plugin source.'
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
	@Patch(':sourceId/status')
	public async updateStatus(
		@Param('sourceId', UUIDValidationPipe) sourceId: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body() updateDto: { status: 'active' | 'inactive' | 'deleted' | 'restored' }
	): Promise<void> {
		if (updateDto.status === 'restored') {
			return this.commandBus.execute(new RecoverPluginSourceCommand(sourceId, versionId, pluginId));
		}

		// Handle other status updates as needed
		// Note: Implement appropriate command handling for other statuses
		throw new Error(`Status '${updateDto.status}' update not implemented yet`);
	}
}
