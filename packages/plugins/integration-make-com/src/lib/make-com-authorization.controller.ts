import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { MakeComOAuthService } from './make-com-oauth.service';

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
	async authorize(@Query() { state }: { state?: string }, @Res() response: Response) {
		try {
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
	async callback(
		@Query() { code, state }: { code?: string; state?: string },
		@Res() response: Response
	) {
		// Get the post-installation redirect URL from config
		const postInstallUrl = this._config.get<string>('makeCom.postInstallUrl');
		try {
			// Validate the input data
			if (!code) {
				throw new HttpException('Invalid callback parameters', HttpStatus.BAD_REQUEST);
			}
			// Validate state parameter - it's required by Make.com
			if (!state) {
				throw new HttpException(
					'Missing required state parameter in callback',
					HttpStatus.BAD_REQUEST
				);
			}

			// Otherwise use provided state
			if (state.length < 32) {
				throw new HttpException('Invalid state parameter', HttpStatus.BAD_REQUEST);
			}

			// Exchange the authorization code for access token
			const tokenResponse = await this.makeComOAuthService.exchangeCodeForToken(code, state);

			// Check if the token exchange was successful
			if (!tokenResponse || !tokenResponse.access_token) {
				throw new HttpException('Failed to exchange authorization code for token', HttpStatus.BAD_REQUEST);
			}

			if (!postInstallUrl) {
				throw new HttpException('Post-installation URL not configured', HttpStatus.INTERNAL_SERVER_ERROR);
			}

			// Combine post-install URL with query params (if any)
			const urlObj = new URL(postInstallUrl);
			urlObj.searchParams.set('success', 'true');
			urlObj.searchParams.set('integration', IntegrationEnum.MakeCom);
			urlObj.searchParams.set('message', 'Successfully authorized Make.com');
			const url = urlObj.toString();

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
