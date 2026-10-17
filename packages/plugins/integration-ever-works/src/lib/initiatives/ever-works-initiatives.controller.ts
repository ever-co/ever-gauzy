import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsString,
	IsUUID,
	MaxLength,
	ValidateIf,
	ValidateNested
} from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksInitiativesService } from './ever-works-initiatives.service';

export class EverWorksInitiativeLinkDto {
	@ApiProperty({ description: 'Ever Works mission id (a mission of the mapped organization).' })
	@IsString()
	@MaxLength(64)
	readonly ewMissionId!: string;

	@ApiProperty({
		description: 'Gauzy strategic initiative id (an initiative of this organization, not leadership-scoped).'
	})
	@IsUUID()
	readonly initiativeId!: string;
}

export class EverWorksInitiativesDecisionDto {
	@ApiPropertyOptional({ type: [EverWorksInitiativeLinkDto] })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@ValidateNested({ each: true })
	@Type(() => EverWorksInitiativeLinkDto)
	readonly links?: EverWorksInitiativeLinkDto[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Ever Works mission ids whose pairing is removed (neither record changes).'
	})
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(2000)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly unlinks?: string[];

	@ApiPropertyOptional({ description: 'Pair every same-title suggestion.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly acceptSuggestions?: boolean;

	@ApiPropertyOptional({ type: [String], description: 'Ever Works mission ids to create as Gauzy initiatives.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly createInGauzy?: string[];

	@ApiPropertyOptional({
		type: [String],
		description:
			'Gauzy initiative ids to create in Ever Works (as paused missions; needs the missions direction "both").'
	})
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	readonly createInEverWorks?: string[];
}

/**
 * `/api/integration/ever-works/mappings/:integrationTenantId/initiatives` (plan 06 G-P2-2, the
 * "Initiatives ↔ Missions" tab of G-P1-11). Same guards and organization-membership check as every
 * management route.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings/:integrationTenantId`)
export class EverWorksInitiativesController {
	constructor(private readonly initiatives: EverWorksInitiativesService) {}

	@Get('/initiatives')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({
		summary:
			'Ever Works missions with their paired initiative or a same-title suggestion, and the unmatched initiatives.'
	})
	list(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.initiatives.initiatives(id, organizationId);
	}

	@Put('/initiatives')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({
		summary:
			'Pair missions and initiatives or remove pairings, accept suggestions, or create one on the other side (nothing is paired silently).'
	})
	decide(
		@Param('integrationTenantId', UUIDValidationPipe) id: ID,
		@Body() dto: EverWorksInitiativesDecisionDto,
		@Query('organizationId') organizationId?: ID
	) {
		return this.initiatives.decide(id, dto as never, organizationId);
	}
}
