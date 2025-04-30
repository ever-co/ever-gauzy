import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { MakeComOAuthService } from './make-com-oauth.service';
import { randomBytes } from 'crypto';

@ApiTags('Make.com OAuth')
@Public()
@Controller('/integration/make-com/oauth')
export class MakeComAuthorizationController {
	constructor(private readonly _config: ConfigService, private readonly makeComOAuthService: MakeComOAuthService) {}

	/**
	 * Initiates the OAuth 2.0 authorization flow with Make.com.
	 * Redirects the user to the Make.com authorization page.
	 *
	 * @param {Response} response - Express Response object.
	 */
	@ApiOperation({ summary: 'Initiate OAuth 2.0 flow with Make.com' })
	@ApiResponse({
		status: 302,
		description: 'Redirects to Make.com authorization page'
	})
	@Get('/authorize')
	async authorize(@Query() query: any, @Res() response: Response) {
		try {
			const state = query.state || undefined;
			const authorizationUrl = this.makeComOAuthService.getAuthorizationUrl(state);
			return response.redirect(authorizationUrl);
		} catch (error) {
			throw new HttpException(
				`Failed to initiate OAuth flow with ${IntegrationEnum.MakeCom}: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Handles the callback from Make.com after user authorization.
	 * Exchanges the authorization code for access and refresh tokens.
	 *
	 * @param {object} query - The query parameters from the callback.
	 * @param {Response} response - Express Response object.
	 */
	@ApiOperation({ summary: 'Handle Make.com OAuth callback' })
	@ApiResponse({
		status: 302,
		description: 'Redirects to the application with token information'
	})
	@Get('/callback')
	async callback(@Query() query: any, @Res() response: Response) {
		// Get the post-installation redirect URL from config
		const postInstallUrl = this._config.get<string>('makeCom.postInstallUrl');
		try {
			// Validate the input data
			if (!query || !query.code) {
				throw new HttpException('Invalid callback parameters', HttpStatus.BAD_REQUEST);
			}

			// Validate state parameter - it's required by Make.com
			if (!query.state) {
				// Generate a secure random state if none provided
				const state = randomBytes(16).toString('hex');
				const authorizationUrl = this.makeComOAuthService.getAuthorizationUrl(state);
				return response.redirect(authorizationUrl);
			}

			// Otherwise use provided state
			if (!query.state || query.state.length < 32) {
				throw new HttpException('Invalid state parameter', HttpStatus.BAD_REQUEST);
			}

			// Exchange the authorization code for access token
			const tokenResponse = await this.makeComOAuthService.exchangeCodeForToken(query.code, query.state);

			// Check if the token exchange was successful
			if (!tokenResponse || !tokenResponse.success) {
				throw new HttpException('Failed to exchange authorization code for token', HttpStatus.BAD_REQUEST);
			}

			if (!postInstallUrl) {
				throw new HttpException('Post-installation URL not configured', HttpStatus.INTERNAL_SERVER_ERROR);
			}

			// Combine post-install URL with query params (if any)
			const queryParamsString = buildQueryString({
				success: 'true',
				integration: 'make_com',
				message: 'Successfully connected to Make.com'
			});
			const url = [postInstallUrl, queryParamsString].filter(Boolean).join('?');

			// Redirect to the application
			return response.redirect(url);
		} catch (error) {
			if (postInstallUrl) {
				const errorMessage = 'Failed to complete OAuth flow';
				const queryParamsString = buildQueryString({
					success: 'false',
					integration: 'make_com',
					message: errorMessage
				});
				const url = [postInstallUrl, queryParamsString].filter(Boolean).join('?');
				return response.redirect(url);
			}
			throw new HttpException(
				`Failed to complete OAuth flow with ${IntegrationEnum.MakeCom}: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
