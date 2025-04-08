import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { ZAPIER_AUTHORIZATION_URL, ZAPIER_REDIRECT_URI } from './zapier.config';

@ApiTags('Zapier Integrations')
@Controller('/integration/zapier')
export class ZapierAuthorizationController {
	constructor(private readonly _config: ConfigService) { }
	/**
	 * Handles the OAuth2 authorization request
	 * Redirects the user to the zapier authorization URL
	 *
	 * @param redirectUri - The redirect URI provided by Zapier
	 * @param res - Express response object for redirection
	 */
	@Public()
	@Get('oauth/authorize')
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
	async authorize(@Query('redirect_uri') redirectUri: string, @Res() res: Response) {
		try {
			if (!redirectUri) {
				throw new HttpException('Redirect URI is required', HttpStatus.BAD_REQUEST);
			}

			const clientId = this._config.get<string>('zapier.clientId');
			if (!clientId) {
				throw new HttpException('Zapier client ID is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
			}
			const authUrl = `${ZAPIER_AUTHORIZATION_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
			res.redirect(authUrl);
		} catch (error) {
			throw new HttpException(
				'Failed to initiate OAuth2 authorization',
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
	/**
	 * Handles OAuth2 callback after the user authorizes the integration
	 * Redirects the user back to Zapier's redirect_uri with authorization code.
	 *
	 * @param code - The authorization code returned by the OAuth2 provider
	 * @param state - The state parameter for CSRF protection.
	 * @param res - Express response object for redirection.
	 */
	@Public()
	@Get('oauth/callback')
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
			// Validate the input data
			if (!query || !query.code || !query.state) {
				throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
			}
			// Convert query params object to string
			const queryParamsString = buildQueryString({
				code: query.code,
				state: query.state
			});
			/**
			 * Redirect the user back to Zapier's redirect_uri with the authorization code
			 */
			const url = `${ZAPIER_REDIRECT_URI}?${queryParamsString}`;
			// Redirect to the URL
			return res.redirect(url);
		} catch (error) {
			throw new HttpException(
				`Failed to add ${IntegrationEnum.ZAPIER} integration: ${error instanceof Error ? error.message : 'Unknown error'}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
