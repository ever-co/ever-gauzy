import { HttpStatus, ID, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ListPluginSourcesQuery } from '../../application/queries/list-plugin-sources.query';
import { PluginSourceDTO } from '../../shared/dto/plugin-source.dto';
import { IPluginVersion } from '../../shared/models/plugin-version.model';

@ApiTags('Plugin Sources')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId/versions/:versionId/sources')
export class PluginSourceController {
	constructor(private readonly queryBus: QueryBus) {}

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
}
