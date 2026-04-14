import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Headers,
	HttpException,
	HttpStatus,
	Logger,
	NotFoundException,
	Post,
	Query,
	Res,
	UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { ZapierService } from './zapier.service';

@ApiTags('Zapier OAuth2 Authorization')
@Controller('/integration/zapier')
export class ZapierAuthorizationController {
	private readonly logger = new Logger(ZapierAuthorizationController.name);
	constructor(private readonly _config: ConfigService, private readonly zapierService: ZapierService) {}

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
	async authorize(@Query() { state }: { state: string }) {
		return this.zapierService.getAuthorizationUrl({ state });
	}

	/**
	 * Handles the OAuth callback from Zapier after user authorization.
	 * Exchanges the received code for access and refresh tokens.
	 */
	@ApiOperation({ summary: 'Complete Zapier OAuth flow' })
	@ApiResponse({
		status: 200,
		description: 'OAuth flow completed successfully'
	})
	@Public()
	@Get('/oauth/callback')
	async callback(@Query() query: any, @Res() res: Response) {
		try {
			// Add security headers
			res.setHeader('X-Content-Type-Options', 'nosniff');
			res.setHeader('X-Frame-Options', 'DENY');
			res.setHeader('X-XSS-Protection', '1; mode=block');
			res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

			if (!query || !query.code || !query.state) {
				throw new BadRequestException('Authorization code and state are required');
			}

			// Validate authorization code format (basic validation)
			if (typeof query.code !== 'string' || query.code.length < 10) {
				throw new BadRequestException('Invalid authorization code format');
			}

			const postInstallUrl = this._config.get('zapier')?.postInstallUrl;
			if (!postInstallUrl) {
				throw new BadRequestException('Zapier post-install URL is not configured');
			}

			// Validate state parameter and extract tenantId
			const parsedState = await this.zapierService.parseAuthState(query.state);
			if (!parsedState) {
				throw new BadRequestException('Invalid or expired state parameter');
			}

			// Complete the OAuth flow — pass tenantId from state since this is a @Public() endpoint
			await this.zapierService.completeOAuthFlow(query.code, query.state, parsedState.tenantId);

			// Build query parameters for redirect
			const queryParamsString = buildQueryString({
				code: query.code,
				state: query.state
			});

			// Combine Zapier post install URL with query params
			const url = [postInstallUrl, queryParamsString].filter(Boolean).join('?');

			return res.redirect(url);
		} catch (error: any) {
			this.logger.error('OAuth callback failed', error);
			// Re-throw known exceptions
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new HttpException(
				`Failed to add ${IntegrationEnum.ZAPIER} integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * OAuth token exchange endpoint — @Public() so Zapier platform can call it.
	 * Exchanges authorization code for access and refresh tokens.
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
	@Public()
	@Post('/oauth/token')
	async exchangeCodeForToken(
		@Body()
		body: {
			code: string;
			client_id: string;
			client_secret: string;
			redirect_uri: string;
			grant_type: string;
		}
	) {
		try {
			// Validate required parameters
			if (!body.code || !body.client_id || !body.client_secret || !body.redirect_uri) {
				throw new BadRequestException('Missing required parameters');
			}

			if (body.grant_type !== 'authorization_code') {
				throw new BadRequestException('Invalid grant_type. Must be "authorization_code"');
			}

			// Validate client credentials against server-side config (shared across all tenants)
			this.zapierService.validateServerClientCredentials(body.client_id, body.client_secret);

			// Resolve the correct tenant integration by the Gauzy-issued auth code
			const integration = await this.zapierService.findIntegrationByAuthCode(body.code);

			// Validate and consume the authorization code (single-use)
			await this.zapierService.validateAndConsumeAuthCode(integration.id!, body.code, body.redirect_uri);

			// Generate new tokens
			const tokens = await this.zapierService.generateAndStoreNewTokens(integration.id!);

			return tokens;
		} catch (error) {
			this.logger.error('Failed to exchange code for token', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new HttpException('Failed to exchange code for token', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * OAuth token refresh endpoint — @Public() so Zapier platform can call it.
	 * Refreshes an expired access token using a refresh token.
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
	@Public()
	@Post('/oauth/refresh-token')
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

			// Validate client credentials against server-side config (shared across all tenants)
			this.zapierService.validateServerClientCredentials(body.client_id, body.client_secret);

			// Resolve the correct tenant integration by the Gauzy-issued refresh token
			const integration = await this.zapierService.findIntegrationByGauzyRefreshToken(body.refresh_token);
			if (!integration.id) {
				throw new BadRequestException('Invalid refresh token');
			}

			const refreshResult = await this.zapierService.refreshTokenByRefreshToken(
				integration.id,
				body.refresh_token
			);

			return refreshResult;
		} catch (error) {
			this.logger.error('Failed to refresh token', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new HttpException('Failed to refresh token', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Auth test endpoint — validates a Zapier access token.
	 * Called by the Zapier CLI app to verify the connection is working.
	 * Supports both opaque tokens (legacy) and JWT tokens (multi-app OAuth).
	 */
	@ApiOperation({ summary: 'Test Zapier authentication' })
	@ApiResponse({
		status: 200,
		description: 'Authentication is valid'
	})
	@ApiResponse({
		status: 401,
		description: 'Invalid or missing access token'
	})
	@Public()
	@Get('/auth/test')
	async testAuth(@Headers('authorization') authHeader: string) {
		try {
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				throw new UnauthorizedException('Missing or invalid Authorization header');
			}

			const token = authHeader.substring(7); // Strip "Bearer "

			// Try opaque token first (backward compat) — resolves via IntegrationTenant
			try {
				const integration = await this.zapierService.resolveIntegrationFromBearerToken(token);
				return {
					authenticated: true,
					integrationId: integration.id,
					name: IntegrationEnum.ZAPIER
				};
			} catch {
				// No IntegrationTenant yet — fall through to JWT-only verification
			}

			// Verify the JWT is valid (sufficient for auth test — IntegrationTenant
			// may not exist yet when Zapier first tests the OAuth connection)
			const decoded = this.zapierService.verifyJwtToken(token);
			return {
				authenticated: true,
				userId: decoded.id,
				tenantId: decoded.tenantId,
				name: IntegrationEnum.ZAPIER
			};
		} catch (error) {
			this.logger.error('Zapier auth test failed', error);
			throw new UnauthorizedException('Invalid access token');
		}
	}

	/**
	 * Connection label endpoint — returns integration info for Zapier's UI.
	 * Called by the Zapier CLI app to display a label for the connected account.
	 * Supports both opaque tokens (legacy) and JWT tokens (multi-app OAuth).
	 */
	@ApiOperation({ summary: 'Get Zapier connection info' })
	@ApiResponse({
		status: 200,
		description: 'Returns connection info for the Zapier account label'
	})
	@Public()
	@Get('/auth/me')
	async getConnectionInfo(@Headers('authorization') authHeader: string) {
		try {
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				throw new UnauthorizedException('Missing or invalid Authorization header');
			}

			const token = authHeader.substring(7);

			// Try opaque token first (backward compat) — resolves via IntegrationTenant
			try {
				const integration = await this.zapierService.resolveIntegrationFromBearerToken(token);
				return {
					id: integration.id,
					name: IntegrationEnum.ZAPIER,
					email: `zapier-integration@${integration.tenantId || 'gauzy'}`
				};
			} catch {
				// No IntegrationTenant yet — fall through to JWT-only verification
			}

			// Verify the JWT is valid (sufficient for connection label —
			// IntegrationTenant may not exist yet when Zapier first tests the connection)
			const decoded = this.zapierService.verifyJwtToken(token);
			return {
				id: decoded.id,
				name: IntegrationEnum.ZAPIER,
				email: `zapier-integration@${decoded.tenantId || 'gauzy'}`
			};
		} catch (error) {
			this.logger.error('Zapier connection info failed', error);
			throw new UnauthorizedException('Invalid access token');
		}
	}
}
