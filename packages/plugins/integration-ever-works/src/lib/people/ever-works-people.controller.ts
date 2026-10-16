import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksAgentsService } from './ever-works-agents.service';
import { EverWorksPeopleService } from './ever-works-people.service';

export class EverWorksPersonLinkDto {
	@ApiProperty({ description: 'Ever Works user id (a member of the mapped organization).' })
	@IsString()
	@MaxLength(64)
	readonly ewUserId!: string;

	@ApiProperty({ description: 'Gauzy employee id (an active person of this organization).' })
	@IsUUID()
	readonly employeeId!: string;
}

export class EverWorksPeopleDecisionDto {
	@ApiPropertyOptional({ type: [EverWorksPersonLinkDto] })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(5000)
	@ValidateNested({ each: true })
	@Type(() => EverWorksPersonLinkDto)
	readonly links?: EverWorksPersonLinkDto[];

	@ApiPropertyOptional({ type: [String], description: 'Ever Works user ids whose link is removed.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(5000)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	readonly unlinks?: string[];

	@ApiPropertyOptional({ description: 'Link every verified-email suggestion.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly acceptSuggestions?: boolean;
}

/**
 * `/api/integration/ever-works/mappings/:integrationTenantId/{people,agents}` (plan 06 G-P1-6). Same guards
 * and organization-membership check as every management route.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings/:integrationTenantId`)
export class EverWorksPeopleController {
	constructor(
		private readonly people: EverWorksPeopleService,
		private readonly agents: EverWorksAgentsService
	) {}

	@Get('/people')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Ever Works members with their link or a verified-email suggestion, and the unmatched Gauzy people.' })
	listPeople(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.people.people(id, organizationId);
	}

	@Put('/people')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Confirm or remove people links, or accept every suggestion (nothing is linked silently).' })
	decide(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Body() dto: EverWorksPeopleDecisionDto, @Query('organizationId') organizationId?: ID) {
		return this.people.decide(id, dto, organizationId);
	}

	@Get('/agents')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	listAgents(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.agents.list(id, organizationId);
	}

	@Post('/agents/import')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Provision every Ever Works agent of the mapped organization as an agent employee.' })
	importAgents(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.agents.importAll(id, organizationId);
	}
}
