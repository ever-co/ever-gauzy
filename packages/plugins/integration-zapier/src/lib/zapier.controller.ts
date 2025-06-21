import {
	Controller,
	Get,
	UseGuards,
	Query,
	NotFoundException,
	InternalServerErrorException,
	Logger,
	UnauthorizedException,
	BadRequestException,
	Body,
	Post,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { ZapierService } from './zapier.service';
import { ICreateZapierIntegrationInput, IZapierEndpoint, IZapierIntegrationSettings } from './zapier.types';
import { randomBytes } from 'node:crypto';

@ApiTags('Zapier Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/zapier')
export class ZapierController {
	private readonly logger = new Logger(ZapierController.name);

	/**
	 * Creates an instance of the ZapierController.
	 * Initializes the controller with the required services for managing Zapier integrations.
	 * Ensures that the necessary configuration values are properly set in the environment variables.
	 * These are essential for enabling secure and functional Zapier integrations.
	 */
	constructor(private readonly zapierService: ZapierService) {}

	/**
	 * Creates a new Zapier integration.
	 * This method handles the initialization of a new Zapier integration by generating an authorization URL
	 * for the user to authorize the integration.
	 */
	@ApiOperation({ summary: 'Initialize a new Zapier integration' })
	@ApiResponse({
		status: 200,
		description: 'Authorization URL generated successfully'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing required fields'
	})
	@Post('/settings')
	async initializeIntegration(@Body() body: ICreateZapierIntegrationInput) {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}
		// validate body inputs
		if (!body.client_id || !body.client_secret) {
			throw new BadRequestException('Missing required fields');
		}

		// Generate state parameter for CSRF protection
		const state = Buffer.from(randomBytes(32)).toString('base64url');

		// Store the client credentials and state for later use in the callback
		const integration = await this.zapierService.storeIntegrationCredentials({
			...body,
			state
		});

		// Generate authorization URL for user to complete OAuth flow
		const authorizationUrl = this.zapierService.getAuthorizationUrl({
			clientId: body.client_id,
			state
		});

		return {
			authorizationUrl,
			integrationId: integration.id
		};
	}

	/**
	 * Get available Zapier triggers.
	 * This method retrieves the available triggers from Zapier based on the provided token.
	 */
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
		try {
			this.validateToken(token, true);
			return await this.zapierService.fetchTriggers(token);
		} catch (error) {
			this.handleZapierError(error, 'triggers');
		}
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
		try {
			this.validateToken(token, true);
			return await this.zapierService.fetchActions(token);
		} catch (error) {
			this.handleZapierError(error, 'actions');
		}
	}

	/**
	 * Helper method to validate Zapier token
	 */
	private validateToken(token: string, isThrowUnauthorizedOnMissingToken = false) {
		const exception = isThrowUnauthorizedOnMissingToken ? UnauthorizedException : BadRequestException;
		if (!token) {
			throw new exception('Token parameter is required');
		}
		if (!token.trim()) {
			throw new exception('Token parameter cannot be empty');
		}
	}

	/**
	 * Helper method to handle Zapier endpoint errors
	 */
	private handleZapierError(error: any, endpointType: string): never {
		this.logger.error(`Failed to fetch Zapier ${endpointType}`, error);

		// Re-throw specific known errors
		if (error instanceof UnauthorizedException) {
			throw error;
		}
		if (error instanceof BadRequestException) {
			throw error;
		}
		if (error instanceof NotFoundException) {
			throw error;
		}
		// For unexpected errors, include original error message
		throw new InternalServerErrorException(
			`Failed to fetch Zapier ${endpointType}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}

	/**
	 * OAuth token exchange endpoint
	 * Exchanges authorization code for access and refresh tokens
	 */
	@ApiOperation({ summary: 'Exchange authorization code for tokens' })
	@ApiResponse({
		status: 200,
		description: 'Successfully exchanged code for tokens'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad request - Invalid parameters'
	})
	@Post('/token')
	async exchangeCodeForToken(
		@Body()
		body: {
			code: string;
			client_id: string;
			client_secret: string;
			redirect_uri: string;
			grant_type: string;
			state: string;
		}
	) {
		try {
			// Add tenant validation to token exchange endpoint
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			// Validate required parameters
			if (!body.code || !body.client_id || !body.client_secret || !body.redirect_uri || !body.state) {
				throw new BadRequestException('Missing required parameters');
			}

			if (body.grant_type !== 'authorization_code') {
				throw new BadRequestException('Invalid grant_type. Must be "authorization_code"');
			}

			// Validate and delete the state parameter
			const isValidState = await this.zapierService.validateAndDeleteState(body.state, tenantId);
			if (!isValidState) {
				throw new BadRequestException('Invalid or expired state parameter');
			}

			// Find the integration record using the client_id from the request
			const integration = await this.zapierService.findIntegrationByClientId(body.client_id);
			if (!integration.id) {
				throw new BadRequestException('Invalid integration ID');
			}

			// Generate new tokens
			const tokens = await this.zapierService.generateAndStoreNewTokens(integration.id);

			return tokens;
		} catch (error) {
			this.logger.error('Failed to exchange code for token', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to exchange code for token');
		}
	}

	/**
	 * OAuth token refresh endpoint
	 * Refreshes an expired access token using a refresh token
	 */
	@ApiOperation({ summary: 'Refresh access token' })
	@ApiResponse({
		status: 200,
		description: 'Successfully refreshed token'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad request - Invalid parameters'
	})
	@Post('/refresh-token')
	async refreshAccessToken(
		@Body() body: { refresh_token: string; client_id: string; client_secret: string; grant_type: string }
	) {
		try {
			// Validate required parameters
			if (!body.refresh_token || !body.client_id || !body.client_secret) {
				throw new BadRequestException('Missing required parameters');
			}

			if (body.grant_type !== 'refresh_token') {
				throw new BadRequestException('Invalid grant_type. Must be "refresh_token"');
			}

			// Find integration by client_id and verify refresh token
			const integration = await this.zapierService.findIntegrationByClientId(body.client_id);
			const refreshResult = await this.zapierService.refreshTokenByRefreshToken(
				integration.id ?? '',
				body.refresh_token
			);

			return refreshResult;
		} catch (error) {
			this.logger.error('Failed to refresh token', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to refresh token');
		}
	}

	/**
	 * Get Zapier access token for a given integration
	 */
	@ApiOperation({ summary: 'Get Zapier access token for integration' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier access token'
	})
	@ApiResponse({
		status: 404,
		description: 'Access token not found for the given integration'
	})
	@Get('/token/:integrationId')
	async getZapierToken(@Param('integrationId') integrationId: string) {
		try {
			return await this.zapierService.getZapierToken(integrationId);
		} catch (error) {
			this.logger.error(`Failed to get Zapier token for integration ID ${integrationId}`, error);
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to get Zapier token');
		}
	}

	/**
	 * Retrieves the Zapier integration settings for the current tenant.
	 *
	 * @returns {Promise<IZapierIntegrationSettings>} A promise that resolves with the tenant's Zapier integration settings.
	 */
	@ApiOperation({ summary: 'Get Zapier integration settings for tenant' })
	@ApiResponse({
		status: 200,
		description: 'Retrieved tenant Zapier settings'
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant not found in request context'
	})
	@Get('/settings')
	async getSettings(): Promise<IZapierIntegrationSettings> {
		return this.zapierService.getIntegrationSettings();
	}
}
