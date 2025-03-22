import { HttpStatus, ID, IPagination, PluginSourceType } from '@gauzy/contracts';
import {
	FileStorage,
	FileStorageFactory,
	LazyFileInterceptor,
	PaginationParams,
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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CreatePluginVersionCommand } from '../../application/commands/create-plugin-version.command';
import { ListPluginVersionsQuery } from '../../application/queries/list-plugin-versions.query';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { FileDTO } from '../../shared/dto/file.dto';
import { PluginVersionDTO } from '../../shared/dto/plugin-version.dto';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { PluginFactory } from '../../shared/utils/plugin-factory.util';
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
		@Query() params: PaginationParams<IPluginVersion>
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
			console.warn('Plugin file key is empty');
			return;
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
}
