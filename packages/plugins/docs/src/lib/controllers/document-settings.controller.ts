import { Body, Controller, Get, HttpStatus, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	RequestContext,
	TenantPermissionGuard,
	UseValidationPipe
} from '@gauzy/core';
import { UpdateDocumentSettingsCommand } from '../commands/update-document-settings.command';
import { DocumentSettingsDTO, DocumentSettingsQueryDTO, IDocumentSettings } from '../dto/document-settings.dto';
import { GetDocumentSettingsQuery } from '../queries/get-document-settings.query';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/settings')
export class DocumentSettingsController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Org defaults + read-only deployment capabilities.
	 */
	@ApiOperation({ summary: 'Get the Documents org defaults and deployment capabilities.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Settings retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/')
	public async getSettings(@Query() query: DocumentSettingsQueryDTO): Promise<IDocumentSettings> {
		return this.queryBus.execute(
			new GetDocumentSettingsQuery(query?.organizationId ?? RequestContext.currentOrganizationId())
		);
	}

	/**
	 * Partial update of the org-defaults block only (`capabilities` is never writable).
	 */
	@ApiOperation({ summary: 'Update the Documents org defaults.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Settings updated successfully.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/')
	public async updateSettings(
		@Body() input: DocumentSettingsDTO,
		@Query() query?: DocumentSettingsQueryDTO
	): Promise<IDocumentSettings> {
		return this.commandBus.execute(
			new UpdateDocumentSettingsCommand(query?.organizationId ?? RequestContext.currentOrganizationId(), input)
		);
	}
}
