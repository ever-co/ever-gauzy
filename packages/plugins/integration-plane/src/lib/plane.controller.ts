import {
	Controller,
	Post,
	Get,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	Permissions,
	UUIDValidationPipe,
	UseValidationPipe,
	PermissionGuard,
	TenantPermissionGuard
} from '@gauzy/core';
import { PlaneIntegrationService } from './plane-integration.service';
import { ConfigurePlaneIntegrationDto } from './dto/configure-plane-integration.dto';
import { UpdatePlaneSettingsDto } from './dto/update-plane-settings.dto';

@ApiTags('Plane Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/integration/plane')
export class PlaneController {
	constructor(private readonly planeIntegrationService: PlaneIntegrationService) {}

	/**
	 * Configure Plane integration for the current tenant.
	 * Auto-generates API key and secret.
	 */
	@Post('/setup')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Configure Plane integration for the current tenant.' })
	@ApiResponse({ status: 201, description: 'Plane integration configured successfully.' })
	@ApiResponse({ status: 409, description: 'Plane integration already configured.' })
	async setupIntegration(
		@Body() dto: ConfigurePlaneIntegrationDto,
		@Query('organizationId') organizationId?: string
	): Promise<{ integrationTenantId: ID; apiKey: string; apiSecret: string }> {
		return await this.planeIntegrationService.setupIntegration(dto, organizationId);
	}

	/**
	 * Get current Plane integration settings for the tenant.
	 * Does NOT return API key or secret.
	 */
	@Get('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Get Plane integration settings for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Settings retrieved successfully.' })
	@ApiResponse({ status: 404, description: 'Plane integration not configured.' })
	async getSettings(@Query('organizationId') organizationId?: string) {
		return await this.planeIntegrationService.getSettings(organizationId);
	}

	/**
	 * Update Plane UI URLs for the current tenant.
	 */
	@Put('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Update Plane integration settings.' })
	@ApiResponse({ status: 200, description: 'Settings updated successfully.' })
	@ApiResponse({ status: 404, description: 'Plane integration not configured.' })
	async updateSettings(
		@Body() dto: UpdatePlaneSettingsDto,
		@Query('organizationId') organizationId?: string
	): Promise<{ integrationTenantId: ID; updated: boolean }> {
		return await this.planeIntegrationService.updateSettings(dto, organizationId);
	}

	/**
	 * Remove/archive Plane integration for the tenant.
	 */
	@Delete('/:integrationTenantId')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Remove Plane integration for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Integration removed successfully.' })
	@ApiResponse({ status: 404, description: 'Plane integration not configured.' })
	async removeIntegration(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID
	): Promise<{ success: boolean }> {
		return await this.planeIntegrationService.removeIntegration(integrationTenantId);
	}

	/**
	 * Regenerate API key and secret for the Plane integration.
	 */
	@Post('/regenerate-key')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Regenerate Plane integration API key and secret.' })
	@ApiResponse({ status: 200, description: 'API key regenerated successfully.' })
	@ApiResponse({ status: 404, description: 'Plane integration not configured.' })
	async regenerateApiKey(
		@Query('organizationId') organizationId?: string
	): Promise<{ apiKey: string; apiSecret: string }> {
		return await this.planeIntegrationService.regenerateApiKey(organizationId);
	}

	/**
	 * Check if Plane integration is enabled for the current tenant.
	 */
	@Get('/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Check Plane integration status for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Status retrieved successfully.' })
	async getStatus(): Promise<{ isEnabled: boolean; integrationTenantId: ID | null }> {
		return await this.planeIntegrationService.getStatus();
	}
}
