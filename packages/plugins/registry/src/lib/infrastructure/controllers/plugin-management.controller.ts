import { HttpStatus, ID, PermissionsEnum, PluginSourceType } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	PermissionGuard,
	Permissions,
	RequestContext,
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
import {
	CreatePluginCommand,
	DeletePluginCommand,
	GetPluginTenantByPluginQuery,
	UpdatePluginCommand
} from '../../application';
import { LazyAnyFileInterceptor, PluginOwnerGuard } from '../../core';
import { Plugin } from '../../domain';
import { CreatePluginDTO, FileDTO, IPlugin, IPluginSource, UpdatePluginDTO } from '../../shared';
import { GauzyStorageProvider, UploadedPluginStorage } from '../storage';

@ApiTags('Plugin Management')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins')
export class PluginManagementController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

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
		LazyAnyFileInterceptor({
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	public async create(
		@Body() input: CreatePluginDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPlugin> {
		try {
			// Validate files against sources
			this.validateFilesAgainstSources(input.version.sources, files);
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
			// Process each source
			const sources = await Promise.all(
				input.version.sources.map(async (source) => {
					if (source.type === PluginSourceType.GAUZY) {
						// Find matching file for this source
						const file = this.findFileForSource(files, source);

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
				new CreatePluginCommand({
					...input,
					version: {
						...input.version,
						sources
					}
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
		LazyAnyFileInterceptor({
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@Permissions(PermissionsEnum.PLUGIN_UPDATE)
	@UseGuards(PluginOwnerGuard)
	@Put(':id')
	public async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdatePluginDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPlugin> {
		try {
			// Validate files against sources
			this.validateFilesAgainstSources(input.version.sources as IPluginSource[], files);
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());
			// Process each source
			const sources = await Promise.all(
				input.version.sources.map(async (source) => {
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
				new UpdatePluginCommand(id, {
					...input,
					version: {
						...input.version,
						sources
					}
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
	 * Partially updates an existing plugin by ID.
	 */
	@ApiOperation({
		summary: 'Partially update plugin',
		description: 'Partially updates an existing plugin record with only the provided fields.'
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
		description: 'Partial plugin metadata to update'
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
	@Permissions(PermissionsEnum.PLUGIN_UPDATE)
	@UseGuards(PluginOwnerGuard)
	@Patch(':id')
	public async partialUpdate(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: Partial<UpdatePluginDTO>
	): Promise<IPlugin> {
		return this.commandBus.execute(new UpdatePluginCommand(id, input as UpdatePluginDTO));
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
	@Permissions(PermissionsEnum.PLUGIN_DELETE)
	@UseGuards(PluginOwnerGuard)
	@Delete(':id')
	public async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new DeletePluginCommand(id));
	}

	/**
	 * Retrieves plugin tenant ID for a specific plugin.
	 * If the plugin tenant doesn't exist, it will be created.
	 */
	@ApiOperation({
		summary: 'Get plugin tenant by plugin ID',
		description:
			'Retrieves or creates a plugin tenant relationship for a specific plugin. Returns the plugin tenant ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin',
		required: true
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant retrieved or created successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided.'
	})
	@Get(':id/tenant')
	public async getPluginTenant(@Param('id', UUIDValidationPipe) id: ID): Promise<{ id: ID; pluginId: ID }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.queryBus.execute(new GetPluginTenantByPluginQuery(id, tenantId, organizationId));
	}
}
