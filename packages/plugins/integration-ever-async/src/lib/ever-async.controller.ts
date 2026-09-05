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
import { EverAsyncIntegrationService } from './ever-async-integration.service';
import { ConfigureEverAsyncIntegrationDto } from './dto/configure-ever-async-integration.dto';
import { UpdateEverAsyncSettingsDto } from './dto/update-ever-async-settings.dto';
import { VerifyEverAsyncConnectionDto } from './dto/verify-ever-async-connection.dto';

@ApiTags('Ever Async Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/integration/ever-async')
export class EverAsyncController {
	constructor(private readonly everAsyncIntegrationService: EverAsyncIntegrationService) {}

	/**
	 * Configure the Ever Async integration for the current tenant:
	 * stores the Ever Async server URL, the API token (write-only) and the
	 * initial chat-user → employee mappings.
	 */
	@Post('/setup')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Configure Ever Async integration for the current tenant.' })
	@ApiResponse({ status: 201, description: 'Ever Async integration configured successfully.' })
	@ApiResponse({ status: 409, description: 'Ever Async integration already configured.' })
	async setupIntegration(
		@Body() dto: ConfigureEverAsyncIntegrationDto,
		@Query('organizationId') organizationId?: string
	): Promise<{ integrationTenantId: ID }> {
		return await this.everAsyncIntegrationService.setupIntegration(dto, organizationId);
	}

	/**
	 * Get current Ever Async integration settings for the tenant.
	 * Does NOT return the API token (write-only credential).
	 */
	@Get('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Get Ever Async integration settings for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Settings retrieved successfully.' })
	@ApiResponse({ status: 404, description: 'Ever Async integration not configured.' })
	async getSettings(@Query('organizationId') organizationId?: string) {
		return await this.everAsyncIntegrationService.getSettings(organizationId);
	}

	/**
	 * Update Ever Async integration settings (server URL, token, user mappings).
	 */
	@Put('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Update Ever Async integration settings.' })
	@ApiResponse({ status: 200, description: 'Settings updated successfully.' })
	@ApiResponse({ status: 404, description: 'Ever Async integration not configured.' })
	async updateSettings(
		@Body() dto: UpdateEverAsyncSettingsDto,
		@Query('organizationId') organizationId?: string
	): Promise<{ integrationTenantId: ID; updated: boolean }> {
		return await this.everAsyncIntegrationService.updateSettings(dto, organizationId);
	}

	/**
	 * Verify connectivity to an Ever Async server by pinging its `/healthz`
	 * endpoint. Accepts an explicit `serverUrl` (connect wizard, before saving)
	 * or falls back to the stored setting.
	 */
	@Post('/verify')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Verify connectivity to the Ever Async server (/healthz ping).' })
	@ApiResponse({ status: 200, description: 'Ever Async server is reachable.' })
	@ApiResponse({ status: 502, description: 'Ever Async server is not reachable.' })
	async verifyConnection(@Body() dto: VerifyEverAsyncConnectionDto): Promise<{ ok: boolean; serverUrl: string }> {
		return await this.everAsyncIntegrationService.verifyConnection(dto.serverUrl);
	}

	/**
	 * Check if the Ever Async integration is enabled for the current tenant.
	 */
	@Get('/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@ApiOperation({ summary: 'Check Ever Async integration status for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Status retrieved successfully.' })
	async getStatus(): Promise<{ isEnabled: boolean; integrationTenantId: ID | null }> {
		return await this.everAsyncIntegrationService.getStatus();
	}

	/**
	 * Remove/archive the Ever Async integration for the tenant.
	 */
	@Delete('/:integrationTenantId')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Remove Ever Async integration for the current tenant.' })
	@ApiResponse({ status: 200, description: 'Integration removed successfully.' })
	@ApiResponse({ status: 404, description: 'Ever Async integration not configured.' })
	async removeIntegration(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID
	): Promise<{ success: boolean }> {
		return await this.everAsyncIntegrationService.removeIntegration(integrationTenantId);
	}
}
