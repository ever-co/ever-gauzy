import { Controller, Post, Body, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	IIntegrationTenant,
	IIntegrationSetting,
	PermissionsEnum,
	ID,
	ICreateZapierIntegrationInput,
	IZapierEndpoint
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ZapierService } from './zapier.service';

@ApiTags('Zapier Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/zapier')
export class ZapierController {
	constructor(private readonly _zapierService: ZapierService) {}

	@ApiOperation({ summary: 'Get Zapier integration token by integration ID' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier integration token'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/token/:integrationId')
	async getZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<IIntegrationSetting> {
		return await this._zapierService.getZapierToken(integrationId);
	}

	@ApiOperation({ summary: 'Refresh Zapier integration token by integration ID' })
	@ApiResponse({
		status: 200,
		description: 'Successfully refreshed Zapier integration token'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/refresh-token/:integrationId')
	async refreshZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<string> {
		return await this._zapierService.refreshToken(integrationId);
	}

	@ApiOperation({ summary: 'Create new Zapier integration' })
	@ApiResponse({
		status: 200,
		description: 'Successfully created Zapier integration'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Post('/integration')
	async create(@Body() body: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		return await this._zapierService.addIntegration(body);
	}

	@ApiOperation({ summary: 'Get available Zapier triggers' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier triggers'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/triggers')
	async getTriggers(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		return await this._zapierService.fetchTriggers(token);
	}

	@ApiOperation({ summary: 'Get available Zapier actions' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier actions'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/actions')
	async getActions(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		return await this._zapierService.fetchActions(token);
	}
}
