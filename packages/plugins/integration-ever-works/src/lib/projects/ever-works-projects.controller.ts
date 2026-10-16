import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksProjectsService } from './ever-works-projects.service';

export class EverWorksProjectLinkDto {
	@ApiProperty({ description: 'Ever Works work id (a work of the mapped organization).' })
	@IsString()
	@MaxLength(64)
	readonly ewWorkId!: string;

	@ApiProperty({ description: 'Gauzy project id (an active project of this organization).' })
	@IsUUID()
	readonly projectId!: string;
}

export class EverWorksProjectsDecisionDto {
	@ApiPropertyOptional({ type: [EverWorksProjectLinkDto] })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@ValidateNested({ each: true })
	@Type(() => EverWorksProjectLinkDto)
	readonly links?: EverWorksProjectLinkDto[];

	@ApiPropertyOptional({ type: [String], description: 'Ever Works work ids whose pairing is removed (neither record changes).' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly unlinks?: string[];

	@ApiPropertyOptional({ description: 'Pair every same-URL or same-name suggestion.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly acceptSuggestions?: boolean;

	@ApiPropertyOptional({ type: [String], description: 'Ever Works work ids to create a Gauzy project from.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly createInGauzy?: string[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Gauzy project ids to create in Ever Works as repo-less works of kind `project` (G-P2-5; needs Ever Works project works switched on).'
	})
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(100)
	@IsUUID('all', { each: true })
	readonly createInEverWorks?: string[];
}

/**
 * `/api/integration/ever-works/mappings/:integrationTenantId/projects` (plan 06 G-P1-8): the Projects tab
 * (projects ↔ works, link only). Same guards and organization-membership check as every management route.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings/:integrationTenantId`)
export class EverWorksProjectsController {
	constructor(private readonly projects: EverWorksProjectsService) {}

	@Get('/projects')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Ever Works works with their paired project or a same-URL/same-name suggestion, and the unmatched projects.' })
	list(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.projects.projects(id, organizationId);
	}

	@Put('/projects')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Pair projects with works or remove pairings, accept suggestions, create a project from a work, or create a work from a project.' })
	decide(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Body() dto: EverWorksProjectsDecisionDto, @Query('organizationId') organizationId?: ID) {
		return this.projects.decide(id, dto as never, organizationId);
	}
}
