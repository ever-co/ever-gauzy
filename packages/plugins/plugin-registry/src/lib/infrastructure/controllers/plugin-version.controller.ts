import { HttpStatus, ID, IPagination } from '@gauzy/contracts';
import { PaginationParams, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ListPluginVersionsQuery } from '../../application/queries/list-plugin-versions.query';
import { PluginVersionDTO } from '../../shared/dto/plugin-version.dto';
import { CreatePluginVersionCommand } from '../../application/commands/create-plugin-version.command';
import { IPluginVersion } from '../../shared/models/plugin-version.model';

@ApiTags('Plugin Versions')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@Controller('/plugins/:id/versions')
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
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<IPluginVersion>
	): Promise<IPagination<IPluginVersion>> {
		return this.queryBus.execute(new ListPluginVersionsQuery(id, params));
	}

	@ApiOperation({ summary: 'Create a new plugin version' })
	@ApiParam({
		name: 'id',
		type: 'string',
		format: 'uuid',
		description: 'The UUID of the plugin for which a new version is being created.'
	})
	@ApiBody({ type: PluginVersionDTO, description: 'The data required to create a new plugin version.' })
	@ApiResponse({ status: 201, description: 'Plugin version successfully created.', type: PluginVersionDTO })
	@ApiResponse({ status: 400, description: 'Bad request - Validation failed.' })
	@ApiResponse({ status: 404, description: 'Plugin not found.' })
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post()
	public async createVersion(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: PluginVersionDTO
	): Promise<IPluginVersion> {
		return this.commandBus.execute(new CreatePluginVersionCommand(id, input));
	}
}
