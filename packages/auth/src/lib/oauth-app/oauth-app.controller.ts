import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@gauzy/common';
import { SocialAuthService } from '../social-auth.service';

interface OAuthAppAuthorizeQuery {
	client_id?: string;
	redirect_uri?: string;
	response_type?: string;
	scope?: string;
	state?: string;
}

interface OAuthAppTokenRequest {
	grant_type?: string;
	code?: string;
	client_id?: string;
	client_secret?: string;
	redirect_uri?: string;
}

@Public()
@Controller('/integration/ever-gauzy/oauth')
export class OAuthAppController {
	constructor(private readonly service: SocialAuthService) {}

	@Get('/authorize')
	async authorize(
		@Query() query: OAuthAppAuthorizeQuery,
		@Req() req: Request,
		@Res() res: Response
	) {
		const config = this.service.getOAuthAppConfig();

		if (!config.clientId || !config.clientSecret || !config.redirectUris.length || !config.codeSecret) {
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

		const session = (req as any).session;
		if (!session) {
			throw new HttpException('OAuth session is not available', HttpStatus.INTERNAL_SERVER_ERROR);
		}

		session.oauthApp = {
			clientId: query.client_id,
			redirectUri: query.redirect_uri,
			scope: query.scope,
			state: query.state
		};

		return res.redirect('/api/auth/auth0');
	}

	@Post('/token')
	async token(@Body() body: OAuthAppTokenRequest) {
		if (!body.code || !body.client_id || !body.client_secret || !body.redirect_uri) {
			throw new HttpException('Missing token request parameters', HttpStatus.BAD_REQUEST);
		}

		if (body.grant_type && body.grant_type !== 'authorization_code') {
			throw new HttpException('Unsupported grant_type', HttpStatus.BAD_REQUEST);
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
			throw new HttpException(error?.message || 'OAuth token exchange failed', HttpStatus.BAD_REQUEST);
		}
	}
}
