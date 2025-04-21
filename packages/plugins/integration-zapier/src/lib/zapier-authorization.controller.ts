import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
	Query,
	Res,
	UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { buildQueryString } from '@gauzy/utils';
import { IZapierAccessTokens, ZapierGrantType } from './zapier.types';
import { ZAPIER_REDIRECT_URI, ZAPIER_TOKEN_EXPIRATION_TIME } from './zapier.config';
import { ZapierAuthCodeService } from './zapier-auth-code.service';
import { ZapierService } from './zapier.service';
import { CreateZapierIntegrationDto } from './dto';

@ApiTags('Zapier OAuth2 Authorization')
@Controller('/integration/zapier')
export class ZapierAuthorizationController {
	private readonly logger = new Logger(ZapierAuthorizationController.name);
	private refreshLocks: Map<string, boolean> = new Map();
	private allowedDomains: string[] = [];

	constructor(
		private readonly _config: ConfigService,
		private readonly zapierAuthCodeService: ZapierAuthCodeService,
		private readonly zapierService: ZapierService
	) {}

	/**
	 * Helper method to validate the redirect URI against  allowed domains
	 */
	private validateRedirectDomain(redirectUri: string): void {
		try {
			const url = new URL(redirectUri);
			const hostname = url.hostname;

			if (!this.allowedDomains.includes(hostname)) {
				throw new BadRequestException(`Redirect URI domain "${hostname}" is not allowed.`);
			}
		} catch (error) {
			throw new BadRequestException('Invalid redirect URI format.');
		}
	}

	/**
	 * Handles the OAuth2 authorization request
	 * This is the entry point of the OAuth flow
	 */
	@Public()
	@Get('/oauth/authorize')
	@ApiOperation({
		summary: 'Initiate OAuth2 authorization with Zapier'
	})
	@ApiResponse({
		status: 200,
		description: 'Successfully redirected to Zapier authorization URL'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing redirect URI'
	})
	async authorize(
		@Query('zapier_redirect_uri') redirectUri: string,
		@Query('zapier_state') state: string,
		@Query('response_type') responseType: string,
		@Query('client_id') clientId: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug('OAuth authorize request received');
			this.logger.debug(`Redirect URI: ${redirectUri}`);
			this.logger.debug(`State: ${state}`);

			if (!redirectUri) {
				throw new HttpException('Redirect URI is required', HttpStatus.BAD_REQUEST);
			}
			if (!state) {
				throw new HttpException('State parameter is required', HttpStatus.BAD_REQUEST);
			}

			if (responseType !== 'code') {
				throw new HttpException('Response type must be code', HttpStatus.BAD_REQUEST);
			}

			const configuredClientId = this._config.get<string>('zapier.clientId');

			if (clientId !== configuredClientId) {
				throw new HttpException('Invalid client ID', HttpStatus.BAD_REQUEST);
			}

			// Validate the redirect URI against allowed domains
			this.validateRedirectDomain(redirectUri);

			// Store these parameters in the session or state
			// Redirect to the login page with these parameters preserved
			const clientUrl = this._config.get<string>('clientBaseUrl');
			const loginPageUrl = `${clientUrl}/#/auth/login?zapier_redirect_uri=${encodeURIComponent(
				redirectUri
			)}&zapier_state=${encodeURIComponent(state)}`;
			this.logger.debug(`Redirecting to: ${loginPageUrl}`);

			res.redirect(loginPageUrl);
		} catch (error) {
			this.logger.error('Failed to initiate OAuth2 authorization', error);
			throw new HttpException('Failed to initiate OAuth2 authorization', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Handles OAuth2 callback after the user authorizes the integration
	 * This endpoint is called after successful login when auth flow is for Zapier
	 *
	 * @param code - The authorization code returned by the OAuth2 provider
	 * @param state - The state parameter for CSRF protection.
	 * @param res - Express response object for redirection.
	 */
	@Public()
	@Get('/oauth/callback')
	@ApiOperation({
		summary: 'Handle OAuth2 callback from Zapier authorization'
	})
	@ApiResponse({
		status: 200,
		description: 'Successfully processed callback and redirected'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Invalid or missing query parameters'
	})
	async callback(@Query() query: any, @Res() res: Response) {
		try {
			this.logger.debug('OAuth callback request received');
			this.logger.debug(
				`Query parameters: ${JSON.stringify({
					...query,
					code: query.code ? '***' : undefined, // Obfuscate sensitive data
					state: query.state
				})}`
			);

			const { state, zapier_redirect_uri } = query;

			// Validate required parameters
			if (!state) {
				throw new HttpException('Missing state parameter', HttpStatus.BAD_REQUEST);
			}

			// Validate the redirect URI against allowed domains
			this.validateRedirectDomain(zapier_redirect_uri);

			/** Generate an authorization code for this user */
			const user = RequestContext.currentUser();
			if (!user) {
				throw new UnauthorizedException('User not authenticated');
			}

			const code = this.zapierAuthCodeService.generateAuthCode(
				user.id as string,
				user.tenantId as string,
				zapier_redirect_uri
			);

			// Convert query params object to string
			const queryParamsString = buildQueryString({
				code: code,
				state: query.state
			});

			/**
			 * Redirect the user back to Zapier's redirect_uri with the authorization code
			 */
			const url = `${zapier_redirect_uri || ZAPIER_REDIRECT_URI}?${queryParamsString}`;
			this.logger.debug(`Redirecting to Zapier: ${url}`);
			return res.redirect(url);
		} catch (error) {
			this.logger.error('Failed to process OAuth callback', {
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
			throw new HttpException(
				`Failed to add ${IntegrationEnum.ZAPIER} integration: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
	/**
	 * Exchanges an authorization code for an access token
	 */
	@Public()
	@Post('/token')
	@ApiOperation({ summary: 'Exchange authorization code for access token' })
	@ApiResponse({
		status: 200,
		description: 'Successfully exchanged code for token'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Invalid code or credentials'
	})
	async getToken(@Body() body: CreateZapierIntegrationDto): Promise<IZapierAccessTokens> {
		try {
			const { code, client_id, client_secret, redirect_uri, grant_type } = body;
			if (grant_type !== 'authorization_code') {
				throw new BadRequestException('Unsupported grant type');
			}
			if (!code || !client_id || !client_secret || !redirect_uri) {
				throw new BadRequestException('Missing required parameters');
			}

			// Verify client credentials
			const configuredClientId = this._config.get<string>('zapier.clientId');
			const configuredClientSecret = this._config.get<string>('zapier.clientSecret');

			if (client_id !== configuredClientId || client_secret !== configuredClientSecret) {
				throw new HttpException('Invalid client ID', HttpStatus.BAD_REQUEST);
			}

			// Retrieve the user info and stored redirect URI associated with this auth code
			const userInfo = this.zapierAuthCodeService.getUserInfoFromAuthCode(code);
			if (!userInfo) {
				throw new BadRequestException('Invalid or expired authorization code');
			}

			// Verify that the provided redirect_uri matches the stored redirect URI
			if (redirect_uri !== userInfo.redirectUri) {
				throw new BadRequestException('Redirect URI mismatch');
			}

			// Pre-check: Verify all required user information is available
			if (!userInfo.tenantId || !userInfo.userId) {
				this.logger.error('Missing required user information for integration creation', {
					organizationId: userInfo.tenantId,
					userId: userInfo.userId
				});
				throw new BadRequestException('Incomplete user information for integration creation');
			}

			// Create integration and generate tokens
			const tokens = await this.zapierService.createIntegration({
				client_id,
				client_secret,
				code,
				grant_type,
				redirect_uri,
				organizationId: userInfo.organizationId,
				tenantId: userInfo.tenantId,
				userId: userInfo.userId
			});
			return {
				access_token: tokens.access_token,
				refresh_token: tokens.refresh_token,
				expires_in: ZAPIER_TOKEN_EXPIRATION_TIME,
				token_type: 'Bearer'
			};
		} catch (error) {
			this.logger.error('Failed to exchange code for token', error);
			if (
				error instanceof BadRequestException ||
				error instanceof UnauthorizedException ||
				error instanceof NotFoundException
			) {
				throw error;
			}
			throw new BadRequestException('Failed to exchange code for token');
		}
	}

	/**
	 * Refreshes an access token using a refresh token
	 */
	@Public()
	@Post('/refresh-token/:integrationId')
	@ApiOperation({ summary: 'Refresh access token' })
	@ApiResponse({
		status: 200,
		description: 'Successfully refreshed token'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid refresh token'
	})
	@ApiResponse({
		status: 404,
		description: 'NotFound - Integration not found'
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - Token refresh already in progress'
	})
	async refreshToken(
		@Body()
		body: {
			refresh_token: string;
			client_id: string;
			client_secret: string;
			grant_type: ZapierGrantType;
		},
		@Param('integrationId') integrationId: string
	): Promise<IZapierAccessTokens | null> {
		try {
			const { refresh_token, client_id, client_secret, grant_type } = body;

			this.logger.debug(
				`Refresh token request received: ${JSON.stringify({
					refresh_token: '***',
					client_id,
					client_secret,
					grant_type
				})}`
			);

			if (grant_type !== 'refresh_token') {
				throw new BadRequestException('Unsupported grant type');
			}

			if (!refresh_token || !client_id || !client_secret) {
				throw new BadRequestException('Missing required parameters');
			}

			// Verify client credentials
			const configuredClientId = this._config.get<string>('zapier.clientId');
			const configuredClientSecret = this._config.get<string>('zapier.clientSecret');

			if (client_id !== configuredClientId || client_secret !== configuredClientSecret) {
				throw new UnauthorizedException('Invalid client credentials');
			}

			// Check if there's an active refresh operation for this integration
			if (this.refreshLocks.get(integrationId)) {
				this.logger.warn(`Concurrent refresh attempt for integration ID ${integrationId}`);
				throw new HttpException('Token refresh already in progress', HttpStatus.CONFLICT);
			}

			try {
				// Acquire lock
				this.refreshLocks.set(integrationId, true);

				// Refresh the tokens
				const tokens = await this.zapierService.refreshToken(integrationId);
				if (!tokens) {
					throw new NotFoundException('Integration not found');
				}

				// Return the token response
				return {
					access_token: tokens.access_token,
					refresh_token: tokens.refresh_token,
					expires_in: ZAPIER_TOKEN_EXPIRATION_TIME,
					token_type: 'Bearer'
				};
			} finally {
				// Release lock regardless of outcome
				this.refreshLocks.set(integrationId, false);
				setTimeout(() => {
					// Clean up locks after a short period to prevent memory leaks
					this.refreshLocks.delete(integrationId);
				}, 30000); // 30 seconds timeout
			}
		} catch (error) {
			this.logger.error('Failed to refresh token', error);
			if (
				error instanceof BadRequestException ||
				error instanceof UnauthorizedException ||
				error instanceof NotFoundException ||
				error instanceof HttpException
			) {
				throw error;
			}
			throw new UnauthorizedException('Failed to refresh token');
		}
	}
}
