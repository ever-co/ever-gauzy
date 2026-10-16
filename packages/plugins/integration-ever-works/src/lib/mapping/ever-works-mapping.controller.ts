import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksCreateMappingDto, EverWorksUpdateMappingDto } from './dto/ever-works-mapping.dto';
import { EverWorksMappingService } from './ever-works-mapping.service';

/**
 * `/api/integration/ever-works/mappings*` (plan 06 G-P1-4): one Gauzy organization ↔ one pinned Ever
 * Works organization, its settings and sync toggles. Same guards and organization-membership check as
 * the connection routes.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings`)
export class EverWorksMappingController {
	constructor(private readonly mappings: EverWorksMappingService) {}

	@Get()
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: "This organization's Ever Works mapping and settings, or null." })
	current(@Query('organizationId') organizationId?: ID) {
		return this.mappings.current(organizationId);
	}

	@Post()
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Map this organization to a pinned Ever Works organization (seeds the Idea issue type and Ideas view).' })
	create(@Body() dto: EverWorksCreateMappingDto, @Query('organizationId') organizationId?: ID) {
		return this.mappings.create(dto, organizationId);
	}

	@Put('/:integrationTenantId')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	update(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID,
		@Body() dto: EverWorksUpdateMappingDto,
		@Query('organizationId') organizationId?: ID
	) {
		return this.mappings.update(integrationTenantId, dto, organizationId);
	}

	@Post('/:integrationTenantId/projects/default')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The "Ever Works" project of this organization, created when it does not exist.' })
	ensureDefaultProject(@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID, @Query('organizationId') organizationId?: ID) {
		return this.mappings.ensureDefaultProject(integrationTenantId, organizationId);
	}

	@Post('/:integrationTenantId/projects/ideas')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The "Ever Works — Ideas" project of this organization, created when it does not exist.' })
	ensureIdeasProject(@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID, @Query('organizationId') organizationId?: ID) {
		return this.mappings.ensureIdeasProject(integrationTenantId, organizationId);
	}

	@Delete('/:integrationTenantId')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Unmap: archive the mapping; links, logs and synced data are kept.' })
	remove(@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID, @Query('organizationId') organizationId?: ID) {
		return this.mappings.remove(integrationTenantId, organizationId);
	}
}
