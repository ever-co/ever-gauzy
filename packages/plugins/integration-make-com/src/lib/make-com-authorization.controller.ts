import { Controller, Get, Query, Res, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { MakeComOAuthService } from './make-com-oauth.service';
import { MAKE_POST_INSTALL_URL } from './make-com.config';

@ApiTags('Make.com OAuth')
@Public()
@Controller('/integration/make-com/oauth')
export class MakeComAuthorizationController {
	private readonly logger = new Logger(MakeComAuthorizationController.name);

	constructor(private readonly config: ConfigService, private readonly makeComOAuthService: MakeComOAuthService) {}

	/**
	 * Initiates the OAuth 2.0 authorization flow with Make.com.
	 * Redirects the user to the Make.com authorization page.
	 *
	 * @param {object} params - The query parameters.
	 * @param {string} [params.state] - Optional state parameter for OAuth flow.
	 */
	@ApiOperation({ summary: 'Initiate OAuth 2.0 flow with Make.com' })
	@ApiResponse({
		status: 200,
		description: 'Returns the Make.com authorization URL'
	})
	@Get('/authorize')
	async authorize(@Query() { state }: { state?: string }) {
		return {
			authorizationUrl: this.makeComOAuthService.getAuthorizationUrl({ state })
		};
	}

	/**
	 * Resolve the post-install redirect URL from config, with fallback to
	 * the statically resolved constant (which doesn't rely on dotenv-expand).
	 */
	private getPostInstallUrl(): string {
		const fromConfig = this.config.get('makeCom')?.postInstallUrl;

		// Detect unresolved env variable interpolation (e.g. "${CLIENT_BASE_URL}/...")
		if (fromConfig && !fromConfig.includes('${')) {
			return fromConfig;
		}

		return MAKE_POST_INSTALL_URL;
	}

	/**
	 * Build a redirect URL by appending query params.
	 * Handles hash-based Angular routing (e.g. http://host/#/path) by placing
	 * query params before the hash fragment.
	 */
	private buildRedirectUrl(baseUrl: string, params: Record<string, string>): string {
		const queryString = new URLSearchParams(params).toString();
		const hashIndex = baseUrl.indexOf('#');
		if (hashIndex !== -1) {
			// Hash-based Angular routing: place query params after the hash route
			// e.g. http://host/#/path?query instead of http://host?query#/path
			const beforeHash = baseUrl.substring(0, hashIndex);
			const hashPart = baseUrl.substring(hashIndex);
			const separator = hashPart.includes('?') ? '&' : '?';
			return `${beforeHash}${hashPart}${separator}${queryString}`;
		}
		const separator = baseUrl.includes('?') ? '&' : '?';
		return `${baseUrl}${separator}${queryString}`;
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
		@Query()
		{
			code,
			state,
			error,
			error_description
		}: { code?: string; state?: string; error?: string; error_description?: string },
		@Res() response: Response
	) {
		const postInstallUrl = this.getPostInstallUrl();
		this.logger.log(`OAuth callback received. postInstallUrl: ${postInstallUrl}`);

		try {
			// Handle error from Make.com
			if (error) {
				throw new BadRequestException(
					`OAuth error ${error} - ${error_description || 'No description provided'}`
				);
			}
			// Validate required data
			if (!code || !state) {
				throw new BadRequestException('Missing required parameters: code and state');
			}

			// Process the OAuth callback - verify state and exchange code for tokens
			await this.makeComOAuthService.handleAuthorizationCallback(code, state);

			// Redirect to the application with success params
			const url = this.buildRedirectUrl(postInstallUrl, {
				success: 'true',
				integration: IntegrationEnum.MakeCom,
				message: 'Integration connected successfully'
			});

			this.logger.log(`OAuth callback successful, redirecting to: ${url}`);
			return response.redirect(url);
		} catch (error) {
			const errorMessage = error.response?.message || error.message || 'Failed to complete OAuth flow';
			this.logger.error(`OAuth callback failed: ${errorMessage}`);

			const url = this.buildRedirectUrl(postInstallUrl, {
				success: 'false',
				integration: IntegrationEnum.MakeCom,
				message: errorMessage
			});

			return response.redirect(url);
		}
	}
}
