import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';

@ApiTags('Make.com Integrations')
@UseGuards(TenantPermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('integration/make-com')
export class MakeComController {
	constructor(private readonly settingsService: MakeComService) {}

	@ApiOperation({ summary: 'Get Make.com integration settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Retrieved tenant Make.com settings'
	})
	@Get()
	async getSettings() {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new Error('Tenant ID not found in request context');
		}

		return this.settingsService.getSettingsForTenant(tenantId);
	}

	@ApiOperation({ summary: 'Update Make.com integration settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Make.com settings updated successfully'
	})
	@Post()
	async updateSettings(@Body() input: UpdateMakeComSettingsDTO) {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new Error('Tenant ID not found in request context');
		}

		return this.settingsService.updateSettings(tenantId, input);
	}
}
