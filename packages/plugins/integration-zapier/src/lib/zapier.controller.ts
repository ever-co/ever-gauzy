import { Controller, Post, Body, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

	@Get('/token/:integrationId')
	async getZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<IIntegrationSetting> {
		return await this._zapierService.getZapierToken(integrationId);
	}

	@Get('/refresh-token/:integrationId')
	async refreshZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<string> {
		return await this._zapierService.refreshToken(integrationId);
	}

	@Post('/integration')
	async create(@Body() body: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		return await this._zapierService.addIntegration(body);
	}

	@Get('/triggers')
	async getTriggers(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		return await this._zapierService.fetchTriggers(token);
	}

	@Get('/actions')
	async getActions(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		return await this._zapierService.fetchActions(token);
	}
}
