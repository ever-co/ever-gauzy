import { Controller, Get, Post, Body, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions, PermissionGuard, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';
import { IMakeComIntegrationSettings } from './interfaces/make-com.model';
import { UpdateMakeComSettingsDTO } from './dto';
import { MakeComOAuthService } from './make-com-oauth.service';
import { assertSafeMakeWebhookUrl } from './webhook-url.validator';

@ApiTags('Make.com Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/make-com')
export class MakeComController {
	constructor(
		private readonly makeComService: MakeComService,
		private readonly makeComOAuthService: MakeComOAuthService
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

		// SSRF egress guard: reject webhook URLs that target loopback/private/link-local hosts,
		// non-HTTPS schemes or the cloud-metadata endpoint (GHSA-534m-c6mh-mp98).
		if (settings.webhookUrl) {
			assertSafeMakeWebhookUrl(settings.webhookUrl);
		}

		// Update webhook settings
		return this.makeComService.updateIntegrationSettings({
			isEnabled: settings.isEnabled,
			webhookUrl: settings.webhookUrl
		});
	}

	/**
	 * Initialize Make.com OAuth integration for the current tenant.
	 * Client credentials are read from server-side environment variables
	 * and are never exposed to tenants.
	 */
	@ApiOperation({ summary: 'Initialize Make.com OAuth integration' })
	@ApiResponse({
		status: 200,
		description: 'Make.com OAuth authorization URL generated successfully'
	})
	@ApiResponse({
		status: 400,
		description: 'Server-side OAuth credentials not configured'
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant ID not found in request context'
	})
	@Post('/oauth-settings')
	async initializeIntegration(@Body() body: { organizationId?: string }): Promise<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new NotFoundException('Tenant ID not found in request context');
		}

		// Generate authorization URL first — if this fails (e.g. missing config),
		// we avoid leaving a partial integration record behind.
		const authorizationUrl = await this.makeComOAuthService.getAuthorizationUrl({
			organizationId: body?.organizationId
		});

		// Save the integration with server-side credentials
		const integration = await this.makeComService.addIntegrationSettings(body?.organizationId);

		return {
			authorizationUrl,
			integrationId: integration.id
		};
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

			// Verify state and retrieve the PKCE code verifier
			const stateVerification = await this.makeComOAuthService.verifyState(body.state);
			if (!stateVerification.isValid) {
				throw new BadRequestException('Invalid or expired state parameter');
			}

			// Exchange code for tokens with the PKCE code verifier
			const tokenResponse = await this.makeComOAuthService.exchangeCodeForToken(
				body.code,
				body.state,
				stateVerification.codeVerifier
			);

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
