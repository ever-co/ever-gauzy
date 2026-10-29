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
	ForbiddenException,
	Body,
	Post,
	Put,
	Param,
	Headers,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ID, IZapierCreateZapInput, IZapierZap, IZapierZapTemplate, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { isUUID } from 'class-validator';
import { ZapierService } from './zapier.service';
import { IZapierEndpoint, IZapierIntegrationSettings, IZapierOAuthPublicConfig } from './zapier.types';
import { UpdateZapierSettingsDto } from './dto/update-zapier-settings.dto';
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
	 * Initialize a new Zapier integration.
	 * Stores client credentials and returns the authorization URL to redirect
	 * the admin to Zapier's OAuth consent page.
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
	async initializeIntegration(@Body() body: { organizationId: string }) {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		if (!body?.organizationId) {
			throw new BadRequestException('Organization ID is required');
		}

		// Generate state parameter for CSRF protection
		const state = Buffer.from(randomBytes(32)).toString('base64url');

		// Store the integration with server-side credentials and state
		const integration = await this.zapierService.storeIntegrationCredentials({
			organizationId: body.organizationId,
			state
		});

		// Generate authorization URL using server-side client ID
		const authorizationUrl = this.zapierService.getAuthorizationUrl({ state });

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
	async getTriggers(
		@Query('token') token: string,
		@Query('integrationId') integrationId?: string
	): Promise<IZapierEndpoint[]> {
		try {
			const accessToken = await this.resolveToken(token, integrationId);
			this.validateToken(accessToken, true);
			return await this.zapierService.fetchTriggers(accessToken);
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
	async getActions(
		@Query('token') token: string,
		@Query('integrationId') integrationId?: string
	): Promise<IZapierEndpoint[]> {
		try {
			const accessToken = await this.resolveToken(token, integrationId);
			this.validateToken(accessToken, true);
			return await this.zapierService.fetchActions(accessToken);
		} catch (error) {
			this.handleZapierError(error, 'actions');
		}
	}

	/**
	 * Get Zaps for the authenticated Zapier account.
	 */
	@ApiOperation({ summary: 'Get Zapier zaps' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier zaps'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/zaps')
	async getZaps(
		@Query('token') token: string,
		@Query('integrationId') integrationId?: string
	): Promise<IZapierZap[]> {
		try {
			const accessToken = await this.resolveToken(token, integrationId);
			this.validateToken(accessToken, true);
			return await this.zapierService.fetchZaps(accessToken);
		} catch (error) {
			this.handleZapierError(error, 'zaps');
		}
	}

	/**
	 * Create a new Zap on the authenticated Zapier account.
	 */
	@ApiOperation({ summary: 'Create a new Zapier zap' })
	@ApiResponse({
		status: 201,
		description: 'Successfully created Zapier zap'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing required fields'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Post('/zaps')
	async createZap(
		@Query('token') token: string,
		@Body() body: IZapierCreateZapInput,
		@Query('integrationId') integrationId?: string
	): Promise<IZapierZap> {
		try {
			const accessToken = await this.resolveToken(token, integrationId);
			this.validateToken(accessToken, true);
			if (!body?.title || !Array.isArray(body?.steps) || body.steps.length === 0) {
				throw new BadRequestException('Zap title and at least one step are required');
			}
			return await this.zapierService.createZap(body, accessToken);
		} catch (error) {
			this.handleZapierError(error, 'zaps');
		}
	}

	/**
	 * Get publicly available Zap templates from Zapier.
	 * This Zapier endpoint does not require an OAuth access token — it only
	 * needs the server-configured `client_id`, which is attached in the service.
	 */
	@ApiOperation({ summary: 'Get Zapier zap templates (public)' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier zap templates'
	})
	@Get('/zap-templates')
	async getZapTemplates(@Query('limit') limit?: string): Promise<IZapierZapTemplate[]> {
		try {
			const parsedLimit = limit ? Number(limit) : undefined;
			return await this.zapierService.fetchZapTemplates(parsedLimit);
		} catch (error) {
			this.handleZapierError(error, 'zap-templates');
		}
	}

	/**
	 * The Zapier token to call Zapier with: the `token` query param when the caller sends one,
	 * otherwise the access token stored for `integrationId`, once the caller is checked as a member
	 * of the integration's organization. The token endpoint only hands the browser a masked value,
	 * so the web app sends the integration ID and the token is read here.
	 */
	private async resolveToken(token: string, integrationId?: string): Promise<string> {
		if (token?.trim() || !integrationId?.trim()) {
			return token;
		}
		const setting = await this.zapierService.getZapierTokenForCurrentUser(integrationId);
		return setting?.settingsValue;
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
		if (error instanceof ForbiddenException) {
			throw error;
		}
		// For unexpected errors, include original error message
		throw new InternalServerErrorException(
			`Failed to fetch Zapier ${endpointType}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
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
	 * Retrieves the Zapier integration settings of an organization of the current tenant, for a member of it: the
	 * organization named (the query, else the `Organization-Id` header), else the one of the tenant's only integration.
	 *
	 * @param organizationId - The organization of the integration.
	 * @param organizationHeader - The `Organization-Id` header the web app sends.
	 * @returns {Promise<IZapierIntegrationSettings>} A promise that resolves with the integration's Zapier settings.
	 */
	@ApiOperation({ summary: 'Get Zapier integration settings for tenant' })
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: "The organization of the integration (else the Organization-Id header, else the tenant's only one)"
	})
	@ApiResponse({
		status: 200,
		description: 'Retrieved Zapier settings (the "not configured" default when there is no integration)'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - A malformed organization, or several integrations and no organization'
	})
	@ApiResponse({
		status: 403,
		description: "Forbidden - Not a member of the integration's organization"
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant not found in request context'
	})
	@Get('/settings')
	async getSettings(
		@Query('organizationId') organizationId?: string | string[],
		@Headers('organization-id') organizationHeader?: string | string[]
	): Promise<IZapierIntegrationSettings> {
		return this.zapierService.getIntegrationSettingsForCurrentUser(
			this.organizationOf(organizationId, organizationHeader)
		);
	}

	/**
	 * Updates the Zapier integration settings of an organization of the current tenant (whether it is enabled, and its
	 * webhook URL). `POST /settings` starts a new integration; this changes the one that exists.
	 *
	 * @param body - The settings to store.
	 * @param organizationId - The organization of the integration.
	 * @param organizationHeader - The `Organization-Id` header the web app sends: the organization when the query names none
	 * (with neither, the tenant's only integration).
	 */
	@ApiOperation({ summary: 'Update Zapier integration settings' })
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: "The organization of the integration (else the Organization-Id header, else the tenant's only one)"
	})
	@ApiResponse({
		status: 200,
		description: 'The stored Zapier settings'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Invalid body or webhook URL, or several integrations and no organization'
	})
	@ApiResponse({
		status: 403,
		description: "Forbidden - Not a member of the integration's organization"
	})
	@ApiResponse({
		status: 404,
		description: 'No Zapier integration for the organization'
	})
	@Put('/settings')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async updateSettings(
		@Body() body: UpdateZapierSettingsDto,
		@Query('organizationId') organizationId?: string | string[],
		@Headers('organization-id') organizationHeader?: string | string[]
	): Promise<IZapierIntegrationSettings> {
		return this.zapierService.updateIntegrationSettings(
			body,
			this.organizationOf(organizationId, organizationHeader)
		);
	}

	/**
	 * The organization a request names: the first of the values given (the query, then the header) that is set, which
	 * must be one UUID. `ValidationPipe` skips a primitive parameter, and a repeated query parameter arrives as an
	 * array: unchecked, either answered 500 (a `trim` of an array, or a malformed uuid reaching PostgreSQL).
	 *
	 * @throws BadRequestException for a value that is not one UUID.
	 */
	private organizationOf(...candidates: Array<string | string[] | undefined>): ID | undefined {
		for (const candidate of candidates) {
			const value = typeof candidate === 'string' ? candidate.trim() : candidate;
			if (value === undefined || value === null || value === '') {
				continue;
			}
			if (typeof value !== 'string' || !isUUID(value)) {
				throw new BadRequestException('organizationId must be a single UUID');
			}
			return value;
		}
		return undefined;
	}

	/**
	 * The Zapier OAuth configuration the web app may see: client ID, redirect URI, post-install URL and scopes. Never the
	 * client secret, which stays in the server's environment.
	 */
	@ApiOperation({ summary: 'Get the Zapier OAuth configuration (no secrets)' })
	@ApiResponse({
		status: 200,
		description: 'Client ID, redirect URI, post-install URL and scopes (null when not configured)'
	})
	@Get('/oauth/config')
	getOAuthConfig(): IZapierOAuthPublicConfig {
		return this.zapierService.getOAuthConfig();
	}
}
