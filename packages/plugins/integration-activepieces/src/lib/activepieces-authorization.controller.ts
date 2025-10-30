import { Controller, Get, Post, Body, HttpException, HttpStatus, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { IntegrationEnum } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { buildQueryString } from '@gauzy/utils';
import { firstValueFrom, catchError } from 'rxjs';
import { createHmac, randomBytes } from 'node:crypto';
import { ACTIVEPIECES_OAUTH_AUTHORIZE_URL, ACTIVEPIECES_OAUTH_TOKEN_URL, ACTIVEPIECES_SCOPES, OAUTH_RESPONSE_TYPE, OAUTH_GRANT_TYPE } from './activepieces.config';
import { ActivepiecesQueryDto, ActivepiecesTokenExchangeDto, SaveOAuthSettingsDto } from './dto';
import { IActivepiecesTokenExchangeRequest, IActivepiecesOAuthTokens } from '@gauzy/contracts';
import { ActivepiecesService } from './activepieces.service';
import { RequestContext } from '@gauzy/core';

@ApiTags('ActivePieces Integration')
@Controller('/integration/activepieces')
export class ActivepiecesAuthorizationController {
	constructor(
		private readonly httpService: HttpService,
		private readonly activepiecesService: ActivepiecesService,
		private readonly config: ConfigService
	) {}

	/**
	 * Generate a random state parameter for CSRF protection
	 *
	 * @returns {string} Random state string
	 */
	private generateState(): string {
		return randomBytes(32).toString('base64url');
	}

	/**
	 * Encode tenant and organization info into state parameter
	 *
	 * @param tenantId - Tenant ID
	 * @param organizationId - Organization ID (optional)
	 * @param randomState - Random state for security
	 * @returns Encoded state string
	 */
	private signStatePayload(payload: string): string {
		const secret = this.config.get('activepieces')?.stateSecret;
		if (!secret) {
			throw new HttpException('ActivePieces state secret is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
		}
		return createHmac('sha256', secret).update(payload).digest('base64url');
	}

	private encodeState(tenantId: string, organizationId?: string, randomState?: string): string {
		const stateData = {
			tenantId,
			organizationId,
			state: randomState || this.generateState()
		};
		const payload = JSON.stringify(stateData);
		const sig = this.signStatePayload(payload);
		return `${Buffer.from(payload).toString('base64url')}.${sig}`;
	}

	/**
	 * Decode tenant and organization info from state parameter
	 *
	 * @param encodedState - Encoded state string
	 * @returns Decoded state data
	 */
	private decodeState(encodedState: string): { tenantId: string; organizationId?: string; state: string } {
		try {
			const [payloadB64, sig] = encodedState.split('.');
			if (!payloadB64 || !sig) throw new Error('Invalid state parameter');
			const payload = Buffer.from(payloadB64, 'base64url').toString();
			const expected = this.signStatePayload(payload);
			if (sig !== expected) throw new Error('Invalid state signature');
			return JSON.parse(payload);
		} catch (error) {
			throw new Error('Invalid state parameter');
		}
	}
	/**
	 * Initiate OAuth authorization flow with ActivePieces
	 *
	 * @param {any} query - Query parameters including tenantId and organizationId
	 * @param {Response} response - Express Response object
	 */
	@ApiOperation({
		summary: 'Initiate OAuth flow with ActivePieces',
		description: 'Initiates OAuth flow using tenant-specific configuration if available, otherwise falls back to global config'
	})
	@ApiResponse({
		status: 200,
		description: 'Returns the ActivePieces authorization URL',
		schema: {
			type: 'object',
			properties: {
				authorizationUrl: {
					type: 'string',
					description: 'The URL to redirect the user to for authorization'
				},
				state: {
					type: 'string',
					description: 'The state parameter for CSRF protection'
				}
			}
		}
	})
	@ApiQuery({
		name: 'tenantId',
		required: true,
		type: String,
		description: 'Tenant ID'
	})
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: 'Optional organization ID'
	})
	@Get('/authorize')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async authorize(
		@Query() query: ActivepiecesQueryDto & { tenantId?: string; organizationId?: string },
		@Res() response: Response
	) {
		try {
			const tenantId = RequestContext.currentTenantId();
			// Extract tenant and organization context from query
			const organizationId = query.organizationId;

			if (!tenantId) {
				throw new HttpException('Tenant context is required for OAuth authorization', HttpStatus.BAD_REQUEST);
			}

			// Get tenant-specific or global ActivePieces configuration
			const activepiecesConfig = await this.activepiecesService.getConfig(tenantId, organizationId);

			if (!activepiecesConfig?.clientId || !activepiecesConfig?.callbackUrl) {
				throw new HttpException('ActivePieces configuration is incomplete', HttpStatus.BAD_REQUEST);
			}

			// Generate state parameter with tenant/org context for CSRF protection
			const randomState = query.state || this.generateState();
			const encodedState = this.encodeState(tenantId, organizationId, randomState);

			// Build authorization URL parameters
			const authParams = new URLSearchParams({
				client_id: activepiecesConfig.clientId,
				redirect_uri: activepiecesConfig.callbackUrl,
				response_type: OAUTH_RESPONSE_TYPE,
				scope: ACTIVEPIECES_SCOPES,
				state: encodedState
			});

			// Construct the full authorization URL
			const authorizationUrl = `${ACTIVEPIECES_OAUTH_AUTHORIZE_URL}?${authParams.toString()}`;

			// Return the authorization URL in JSON format instead of redirecting
			return response.json({
				authorizationUrl,
				state: encodedState,
				tenantId,
				organizationId
			});
		} catch (error: any) {
			throw new HttpException(
				`Failed to initiate ${IntegrationEnum.ACTIVE_PIECES} authorization: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Save OAuth settings for a tenant/organization
	 *
	 * @param {SaveOAuthSettingsDto} body - OAuth settings to save
	 */
	@ApiOperation({
		summary: 'Save OAuth settings for ActivePieces integration',
		description: 'Saves client ID and client secret for tenant-specific OAuth configuration'
	})
	@ApiResponse({
		status: 201,
		description: 'OAuth settings saved successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string' },
				integrationTenantId: { type: 'string' }
			}
		}
	})
	@Post('/oauth/settings')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async saveOAuthSettings(@Body() body: SaveOAuthSettingsDto) {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { client_id, client_secret, organizationId } = body;

			if (!tenantId) {
				throw new HttpException('Tenant context is required', HttpStatus.BAD_REQUEST);
			}

			const integrationTenant = await this.activepiecesService.saveOAuthSettings(
				client_id,
				client_secret,
				tenantId,
				organizationId
			);

			return {
				message: 'OAuth settings saved successfully',
				integrationTenantId: integrationTenant.id
			};
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to save OAuth settings: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Handle the callback from ActivePieces after user authorization
	 *
	 * @param {any} query - The query parameters from the callback
	 * @param {Response} response - Express Response object
	 */
	@ApiOperation({
		summary: 'Handle ActivePieces OAuth callback',
		description: 'Handles OAuth callback and redirects to tenant-specific post-install URL'
	})
	@ApiResponse({
		status: 302,
		description: 'Redirects to the application with authorization code'
	})
	@Get('/callback')
	async callback(@Query() query: ActivepiecesQueryDto, @Res() response: Response) {
		try {
			// Validate the input data
			if (!query || !query.code || !query.state) {
				throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
			}

			// Decode tenant and organization info from state
			const { tenantId, organizationId, state: originalState } = this.decodeState(query.state);

			// Get tenant-specific ActivePieces configuration
			const activepiecesConfig = await this.activepiecesService.getConfig(tenantId, organizationId);

			if (!activepiecesConfig?.postInstallUrl) {
				throw new HttpException(
					'ActivePieces post-install URL is not configured for this tenant',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			// Convert query params object to string, including tenant context
			const queryParams: Record<string, string> = {
				code: query.code,
				state: originalState,
				tenantId,
				integration: IntegrationEnum.ACTIVE_PIECES
			};

			// Only include organizationId if it's defined
			if (organizationId) {
				queryParams['organizationId'] = organizationId;
			}

			const queryParamsString = buildQueryString(queryParams);

			// Combine post install URL with query params
			const redirectUrl = [activepiecesConfig.postInstallUrl, queryParamsString].filter(Boolean).join('?');

			// Redirect to the application with the authorization code
			return response.redirect(redirectUrl);
		} catch (error: any) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to handle ${IntegrationEnum.ACTIVE_PIECES} callback: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Exchange authorization code for access token
	 *
	 * @param {IActivepiecesTokenExchangeRequest} body - Token exchange request with tenant context
	 */
	@ApiOperation({
		summary: 'Exchange authorization code for access token',
		description: 'Exchanges authorization code for OAuth tokens using tenant-specific configuration'
	})
	@ApiResponse({
		status: 200,
		description: 'Returns OAuth tokens',
		schema: {
			type: 'object',
			properties: {
				access_token: { type: 'string' },
				refresh_token: { type: 'string' },
				token_type: { type: 'string' },
				expires_in: { type: 'number' },
				scope: { type: 'string' }
			}
		}
	})
	@Post('oauth/token')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async exchangeToken(
		@Body() body: ActivepiecesTokenExchangeDto,
	): Promise<IActivepiecesOAuthTokens> {
		try {
			// Derive tenant and organization context from signed state
			const { tenantId, organizationId } = this.decodeState(body.state);

			if (!tenantId) {
				throw new HttpException('Tenant context is required for token exchange', HttpStatus.BAD_REQUEST);
			}

			// Get tenant-specific ActivePieces configuration
			const activepiecesConfig = await this.activepiecesService.getConfig(tenantId, organizationId);

			if (!activepiecesConfig?.clientId || !activepiecesConfig?.clientSecret) {
				throw new HttpException('ActivePieces OAuth credentials are not configured for this tenant', HttpStatus.BAD_REQUEST);
			}

			// Prepare token exchange request
			const tokenRequest: IActivepiecesTokenExchangeRequest = {
				code: body.code,
				client_id: activepiecesConfig.clientId,
				client_secret: activepiecesConfig.clientSecret,
				redirect_uri: activepiecesConfig.callbackUrl,
				grant_type: OAUTH_GRANT_TYPE.AUTHORIZATION_CODE
			};

			// Exchange authorization code for access token
			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesOAuthTokens>(ACTIVEPIECES_OAUTH_TOKEN_URL, new URLSearchParams(tokenRequest as any), {
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded'
						}
					})
					.pipe(
						catchError((error) => {
							const status = error?.response?.status;
							const data = error?.response?.data;
							const errorMessage = data?.error_description || data?.error || error.message;

							throw new HttpException(
								`Failed to exchange authorization code: ${errorMessage}`,
								status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to exchange ${IntegrationEnum.ACTIVE_PIECES} authorization code: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
