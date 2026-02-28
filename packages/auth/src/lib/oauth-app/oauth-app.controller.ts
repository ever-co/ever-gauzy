import { Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { Public } from '@gauzy/common';
import { OAuthAppPendingRequest, SocialAuthService } from '../social-auth.service';

interface OAuthAppAuthorizeQuery {
	client_id?: string;
	redirect_uri?: string;
	response_type?: string;
	scope?: string;
	state?: string;
}

interface OAuthAppApproveDto {
	request_id?: string;
}

interface OAuthAppTokenRequestDto {
	grant_type?: string;
	code?: string;
	client_id?: string;
	client_secret?: string;
	redirect_uri?: string;
}

@Controller('/integration/ever-gauzy/oauth')
export class OAuthAppController {
	private readonly logger = new Logger(OAuthAppController.name);

	constructor(private readonly service: SocialAuthService) {}

	/**
	 * GET /authorize - Public endpoint.
	 * Validates OAuth params, stores pending request in cache,
	 * and redirects to the frontend consent page.
	 */
	@Public()
	@Get('/authorize')
	async authorize(
		@Query() query: OAuthAppAuthorizeQuery,
		@Res() res: Response
	) {
		const config = this.service.getOAuthAppConfig();

		if (!config.clientId || !config.clientSecret || !config.redirectUris?.length || !config.codeSecret) {
			throw new HttpException('OAuth app is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
		}

		if (!query.client_id || !query.redirect_uri || !query.response_type) {
			throw new HttpException('Missing OAuth parameters', HttpStatus.BAD_REQUEST);
		}

		if (query.response_type !== 'code') {
			throw new HttpException('Unsupported response_type', HttpStatus.BAD_REQUEST);
		}

		if (query.client_id !== config.clientId) {
			throw new HttpException('Invalid client_id', HttpStatus.BAD_REQUEST);
		}

		if (!this.service.isOAuthAppRedirectUriAllowed(query.redirect_uri, config)) {
			throw new HttpException('Invalid redirect_uri', HttpStatus.BAD_REQUEST);
		}

		// Generate a unique request ID and store in cache
		const requestId = randomBytes(32).toString('base64url');
		const pendingRequest: OAuthAppPendingRequest = {
			requestId,
			clientId: query.client_id,
			redirectUri: query.redirect_uri,
			scope: query.scope,
			state: query.state,
			createdAt: Date.now()
		};

		await this.service.storeOAuthAppPendingRequest(pendingRequest);

		// Redirect to the frontend consent page
		const clientBaseUrl = this.service.getClientBaseUrl();
		const redirectUrl = `${clientBaseUrl}/#/auth/oauth-authorize?request_id=${requestId}`;
		return res.redirect(redirectUrl);
	}

	/**
	 * GET /authorize/request/:requestId - Authenticated endpoint (JWT required).
	 * Returns pending request details for the frontend consent page.
	 */
	@Get('/authorize/request/:requestId')
	async getAuthorizeRequest(@Param('requestId') requestId: string) {
		const pending = await this.service.getOAuthAppPendingRequest(requestId);
		if (!pending) {
			throw new HttpException('Authorization request not found or expired', HttpStatus.NOT_FOUND);
		}

		// Return safe info for the consent page (never expose secrets)
		return {
			clientId: pending.clientId,
			scope: pending.scope,
			redirectUri: pending.redirectUri
		};
	}

	/**
	 * POST /authorize - Authenticated endpoint (JWT required).
	 * User approves the authorization request. Generates an authorization code
	 * and returns the redirect URL for the third-party app.
	 */
	@Post('/authorize')
	@HttpCode(HttpStatus.OK)
	async approveAuthorize(
		@Body() body: OAuthAppApproveDto,
		@Req() req: any
	) {
		if (!body.request_id) {
			throw new HttpException('Missing request_id', HttpStatus.BAD_REQUEST);
		}

		const pending = await this.service.getOAuthAppPendingRequest(body.request_id);
		if (!pending) {
			throw new HttpException('Authorization request not found or expired', HttpStatus.NOT_FOUND);
		}

		// Delete the pending request (single-use)
		await this.service.deleteOAuthAppPendingRequest(body.request_id);

		// Extract user from JWT guard (populated by global AuthGuard)
		const user = req.user;
		if (!user?.id || !user?.tenantId) {
			throw new HttpException('User identity not available', HttpStatus.UNAUTHORIZED);
		}

		try {
			// Generate authorization code using existing method
			const code = await this.service.createOAuthAppAuthorizationCode({
				userId: user.id,
				tenantId: user.tenantId,
				clientId: pending.clientId,
				redirectUri: pending.redirectUri,
				scope: pending.scope,
				state: pending.state
			});

			// Build the redirect URL with code and state
			const redirectUrl = new URL(pending.redirectUri);
			redirectUrl.searchParams.set('code', code);
			if (pending.state) {
				redirectUrl.searchParams.set('state', pending.state);
			}

			return {
				redirect_url: redirectUrl.toString()
			};
		} catch (error: any) {
			this.logger.error('Failed to generate authorization code', error?.stack);

			if (error instanceof HttpException) {
				throw error;
			}

			throw new HttpException('Failed to generate authorization code', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * POST /token - Public endpoint.
	 * Exchanges an authorization code for an access token.
	 */
	@Public()
	@Post('/token')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	async token(@Body() body: OAuthAppTokenRequestDto) {
		if (!body.code || !body.client_id || !body.client_secret || !body.redirect_uri) {
			throw new HttpException('Missing token request parameters', HttpStatus.BAD_REQUEST);
		}

		if (!body.grant_type || body.grant_type !== 'authorization_code') {
			throw new HttpException('Missing or unsupported grant_type', HttpStatus.BAD_REQUEST);
		}

		try {
			const token = await this.service.exchangeOAuthAppAuthorizationCode({
				code: body.code,
				clientId: body.client_id,
				clientSecret: body.client_secret,
				redirectUri: body.redirect_uri
			});

			return {
				access_token: token.accessToken,
				token_type: token.tokenType,
				expires_in: token.expiresIn,
				scope: token.scope
			};
		} catch (error: any) {
			this.logger.error('OAuth token exchange failed', error?.stack);

			// Re-throw NestJS HTTP exceptions (they already have safe messages)
			if (error instanceof HttpException) {
				throw error;
			}

			// Never forward raw error.message to the client to avoid leaking internals
			throw new HttpException('OAuth token exchange failed', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
