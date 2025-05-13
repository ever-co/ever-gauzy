import { Controller, Get, Post, Body, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions, PermissionGuard, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';
import { IMakeComIntegrationSettings } from './interfaces/make-com.model';
import { UpdateMakeComOAuthSettingsDTO, UpdateMakeComSettingsDTO } from './dto';

@ApiTags('Make.com Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/make-com')
export class MakeComController {
	constructor(private readonly makeComService: MakeComService, private readonly _config: ConfigService) {}

	/**
	 * Retrieves the Make.com integration settings for the current tenant.
	 *
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves with the tenant's Make.com integration settings.
	 */
	@ApiOperation({ summary: 'Get Make.com integration settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Retrieved tenant Make.com settings'
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant not found in request context'
	})
	@Get('/')
	async getSettings(): Promise<IMakeComIntegrationSettings> {
		return this.makeComService.getIntegrationSettings();
	}

	/**
	 * Updates the Make.com integration settings for the current tenant.
	 *
	 * @param {UpdateMakeComSettingsDTO} input - The DTO containing the updated Make.com settings.
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the updated integration settings.
	 */
	@ApiOperation({ summary: 'Update Make.com integration settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Make.com settings updated successfully'
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant ID not found in request context'
	})
	@Post('/')
    async updateIntegrationSettings(
        @Body() settings: UpdateMakeComSettingsDTO
    ): Promise<IMakeComIntegrationSettings> {
        // Verify tenant context exists
        if (!RequestContext.currentTenantId()) {
            throw new NotFoundException('Tenant ID not found in request context');
        }

        // Update webhook settings
        return this.makeComService.updateIntegrationSettings({
            isEnabled: settings.isEnabled,
            webhookUrl: settings.webhookUrl
        });
    }

	/**
	 * Updates the Make.com OAuth settings for the current tenant.
	 *
	 * @param {UpdateMakeComSettingsDTO} input - The DTO containing the updated Make.com OAuth settings.
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the updated integration settings.
	 */
	@ApiOperation({ summary: 'Update Make.com OAuth settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Make.com OAuth settings updated successfully'
	})
	@ApiResponse({
		status: 400,
		description: 'Both clientId and clientSecret must be provided together'
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant ID not found in request context'
	})
	@Post('/oauth-settings')
	async updateOAuthSettings(@Body() input: UpdateMakeComOAuthSettingsDTO): Promise<IMakeComIntegrationSettings> {
		// Validate that both clientId and clientSecret are provided together
		if ((input.clientId && !input.clientSecret) || (!input.clientId && input.clientSecret)) {
			throw new BadRequestException('Both clientId and clientSecret must be provided together');
		}

		// Verify tenant context exists
		if (!RequestContext.currentTenantId()) {
			throw new NotFoundException('Tenant ID not found in request context');
		}
		// Store new OAuth credentials
		await this.makeComService.saveOAuthCredentials({
			clientId: input.clientId,
			clientSecret: input.clientSecret
		});

		return this.makeComService.getIntegrationSettings();
	}

	/**
	 * Gets the Make.com OAuth configuration for the frontend.
	 * Note: Client secret is intentionally excluded for security reasons.
	 */
	@ApiOperation({ summary: 'Get Make.com OAuth configuration' })
	@ApiResponse({
		status: 200,
		description: 'Retrieved Make.com OAuth configuration'
	})
	@Get('/oauth-config')
	async getOAuthConfig(): Promise<{ clientId: string; redirectUri: string }> {
		// Get client ID from the database
		const clientId = await this.makeComService.getOAuthClientId();

		// Get redirect URI from config (this is typically an environment variable)
		const redirectUri = this._config.get<string>('makeCom.redirectUri');

		if (!clientId || !redirectUri) {
			throw new BadRequestException('OAuth configuration is missing required values.');
		}

		return { clientId, redirectUri };
	}
}
