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
	Get,
	Param,
	Post,
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
import { ListPluginSourcesQuery } from '../../application/queries/list-plugin-sources.query';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { LazyAnyFileInterceptor } from '../../core/interceptors/lazy-any-file.interceptor';
import { FileDTO } from '../../shared/dto/file.dto';
import { PluginSourceDTO } from '../../shared/dto/plugin-source.dto';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { GauzyStorageProvider } from '../storage/providers/gauzy-storage.provider';
import { UploadedPluginStorage } from '../storage/uploaded-plugin.storage';
import { CreatePluginSourceCommand } from '../../application/commands/create-plugin-source.command';

@ApiTags('Plugin Sources')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	@ApiBody({ type: PluginSourceDTO, description: 'The data required to create a new plugin source.' })
	@ApiResponse({ status: 201, description: 'Plugin source successfully created.', type: PluginSourceDTO })
	@ApiResponse({ status: 400, description: 'Bad request - Validation failed.' })
	@ApiResponse({ status: 404, description: 'Version not found.' })
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
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('versionId', UUIDValidationPipe) versionId: ID,
		@Body() source: PluginSourceDTO,
		@UploadedPluginStorage({ multiple: true }) files: FileDTO[]
	): Promise<IPluginSource> {
		try {
			// Validate files against sources
			if (files.length > 0 && source.type !== PluginSourceType.GAUZY) {
				throw new BadRequestException(`We cant upload files for: ${source.type}`);
			}
			// Get the appropriate file storage provider
			const gauzyStorageProvider = new GauzyStorageProvider(new FileStorage());

			// Process each source
			if (source.type === PluginSourceType.GAUZY) {
				// Find matching file for this source
				const file = files.find((file) => file.originalname.includes(source.fileName));
				if (!file?.key) {
					throw new BadRequestException(`Plugin file key is empty for source: ${source.name}`);
				}
				// Validate and extract metadata
				await gauzyStorageProvider.validate(file);
				const metadata = gauzyStorageProvider.extractMetadata(file);
				source = {
					...source,
					...metadata
				};
			}
			return this.commandBus.execute(new CreatePluginSourceCommand(pluginId, versionId, source));
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
}
