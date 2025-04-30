import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions, PermissionGuard } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';
import { IMakeComIntegrationSettings } from './interfaces/make-com.model';

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
	async updateSettings(@Body() input: UpdateMakeComSettingsDTO): Promise<IMakeComIntegrationSettings> {
		return this.makeComService.updateIntegrationSettings(input);
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
	async updateOAuthSettings(@Body() input: UpdateMakeComSettingsDTO): Promise<IMakeComIntegrationSettings> {
		// Validate that both clientId and clientSecret are provided together
		if ((input.clientId && !input.clientSecret) || (!input.clientId && input.clientSecret)) {
			throw new Error('Both clientId and clientSecret must be provided together');
		}

		// Update environment variables with provided OAuth settings if they exist
		if (input.clientId && input.clientSecret) {
			const clientId = this._config.get<string>('makeCom.clientId');
			const clientSecret = this._config.get<string>('makeCom.clientSecret');
			if (clientId !== input.clientId) {
				this._config.set('makeCom.clientId', input.clientId);
			}
			if (clientSecret !== input.clientSecret) {
				this._config.set('makeCom.clientSecret', input.clientSecret);
			}
		}

		// Update webhook settings
		return this.makeComService.updateIntegrationSettings({
			isEnabled: input.isEnabled,
			webhookUrl: input.webhookUrl
		});
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
		const { clientId, redirectUri } = {
			clientId: this._config.get<string>('makeCom.clientId'),
			redirectUri: this._config.get<string>('makeCom.redirectUri')
		};

		if (!clientId || !redirectUri) {
			throw new BadRequestException('OAuth configuration is missing required values.');
		}

		return { clientId, redirectUri };
	}
}
