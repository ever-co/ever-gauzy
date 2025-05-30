import { Controller, Get, Post, Body, UseGuards, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions, PermissionGuard, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';
import { IMakeComCreateIntegration, IMakeComIntegrationSettings } from './interfaces/make-com.model';
import { UpdateMakeComSettingsDTO } from './dto';
import { MakeComOAuthService } from './make-com-oauth.service';

@ApiTags('Make.com Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/make-com')
export class MakeComController {
	constructor(
		private readonly makeComService: MakeComService,
		private readonly makeComOAuthService: MakeComOAuthService,
		private readonly config: ConfigService
	) {}

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
	async updateIntegrationSettings(@Body() settings: UpdateMakeComSettingsDTO): Promise<IMakeComIntegrationSettings> {
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
	async addOAuthSettings(@Body() input: IMakeComCreateIntegration): Promise<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new NotFoundException('Tenant ID not found in request context');
		}

		// Validate input
		if (!input.client_id || !input.client_secret) {
			throw new BadRequestException('Both client_id and client_secret are required');
		}

		// Save the credentials and create/update integration with encrypted secret
		const integration = await this.makeComService.addIntegrationSettings({
			...input,
			client_secret: input.client_secret
		});

		// Generate authorization URL
		const authorizationUrl = this.makeComOAuthService.getAuthorizationUrl({
			clientId: input.client_id
		});

		return {
			authorizationUrl,
			integrationId: integration.id
		};
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
		const makeComConfig = this.config.get('makeCom');
		const redirectUri = makeComConfig?.redirectUri;

		if (!clientId || !redirectUri) {
			throw new BadRequestException('OAuth configuration is missing required values.');
		}

		return { clientId, redirectUri };
	}

	/**
	 * Handle Token requests from Make.com custom apps.
	 * This endpoint is called by your Make.com custom app during the OAuth flow.
	 * It's configured in your custom app's "token" section.
	 */
	@Post('/token')
	@ApiOperation({ summary: 'Handle Make.com token requests (For Custom Apps)' })
	@ApiResponse({
		status: 200,
		description: 'Returns OAuth tokens'
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid request or grant type'
	})
	async tokenEndpoint(
		@Body()
		body: {
			grant_type: string;
			code: string;
			state: string;
			client_id: string;
			client_secret: string;
			redirect_uri: string;
		}
	): Promise<{
		access_token: string;
		token_type: string;
		expires_in: number;
		refresh_token: string;
	}> {
		try {
			// Verify grant_type
			if (body.grant_type !== 'authorization_code') {
				throw new BadRequestException('Unsupported grant type');
			}

			// Validate required fields
			if (!body.code || !body.state || !body.client_id || !body.client_secret) {
				throw new BadRequestException('Missing required parameters');
			}

			// Exchange code for tokens
			const tokenResponse = await this.makeComOAuthService.exchangeCodeForToken(body.code, body.state);

			// Return the token response in the format expected by Make.com
			return {
				access_token: tokenResponse.access_token,
				token_type: tokenResponse.token_type,
				expires_in: tokenResponse.expires_in,
				refresh_token: tokenResponse.refresh_token
			};
		} catch (error) {
			throw new BadRequestException(error.message || 'Invalid request');
		}
	}
}
