import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksTeamsService } from './ever-works-teams.service';

export class EverWorksTeamLinkDto {
	@ApiProperty({ description: 'Ever Works team id (a team of the mapped organization).' })
	@IsString()
	@MaxLength(64)
	readonly ewTeamId!: string;

	@ApiProperty({ description: 'Gauzy team id (an active team of this organization).' })
	@IsUUID()
	readonly teamId!: string;
}

export class EverWorksTeamsDecisionDto {
	@ApiPropertyOptional({ type: [EverWorksTeamLinkDto] })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@ValidateNested({ each: true })
	@Type(() => EverWorksTeamLinkDto)
	readonly links?: EverWorksTeamLinkDto[];

	@ApiPropertyOptional({ type: [String], description: 'Ever Works team ids whose pairing is removed (neither team changes).' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly unlinks?: string[];

	@ApiPropertyOptional({ description: 'Pair every same-name suggestion.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly acceptSuggestions?: boolean;

	@ApiPropertyOptional({ type: [String], description: 'Ever Works team ids to create in Gauzy.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly createInGauzy?: string[];

	@ApiPropertyOptional({ type: [String], description: 'Gauzy team ids to create in Ever Works (top-level teams).' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	readonly createInEverWorks?: string[];
}

/**
 * `/api/integration/ever-works/mappings/:integrationTenantId/teams` (plan 06 G-P1-7): the Teams tab. Same
 * guards and organization-membership check as every management route.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings/:integrationTenantId`)
export class EverWorksTeamsController {
	constructor(private readonly teams: EverWorksTeamsService) {}

	@Get('/teams')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Ever Works teams with their pairing or a same-name suggestion, and the unmatched Gauzy teams.' })
	list(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.teams.teams(id, organizationId);
	}

	@Put('/teams')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Pair teams or remove pairings, accept suggestions, or create a team on the other side (nothing is paired silently).' })
	decide(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Body() dto: EverWorksTeamsDecisionDto, @Query('organizationId') organizationId?: ID) {
		return this.teams.decide(id, dto as never, organizationId);
	}
}
