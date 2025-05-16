import { Controller, Get, Query, Res, HttpException, HttpStatus, BadRequestException, NotFoundException, Redirect } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { MakeComOAuthService } from './make-com-oauth.service';
import { RequestContext } from '@gauzy/core';

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
    @Redirect()
    async authorize(
        @Query() { state}: { state?: string }
    ) {
        return {
            url: this.makeComOAuthService.getAuthorizationUrl({
                state
            }),
            statusCode: HttpStatus.FOUND
        };
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
        const postInstallUrl = this._config.get('makeCom').postInstallUrl;

        try {
            // Validate the input data
            if (!code) {
                throw new HttpException('Invalid callback parameters - missing authorization code', HttpStatus.BAD_REQUEST);
            }

            // Validate state parameter
            if (!state) {
                throw new HttpException(
                    'Missing required state parameter in callback',
                    HttpStatus.BAD_REQUEST
                );
            }

            // Decode the state parameter
            let decodedState;
            try {
                decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
            } catch (error) {
                throw new HttpException('Invalid state parameter format', HttpStatus.BAD_REQUEST);
            }

            const { tenantId, organizationId } = decodedState;

            // Validate decoded state
            if (!tenantId || !organizationId) {
                throw new HttpException('Invalid state parameter - missing tenant or organization context', HttpStatus.BAD_REQUEST);
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

            // Combine post-install URL with query params
            const urlObj = new URL(postInstallUrl);
            urlObj.searchParams.set('success', 'true');
            urlObj.searchParams.set('integration', IntegrationEnum.MakeCom);
            urlObj.searchParams.set('message', 'Successfully authorized Make.com');

            // Add tenant and organization IDs to the redirect URL for reference
            urlObj.searchParams.set('tenantId', tenantId);
            urlObj.searchParams.set('organizationId', organizationId);

            const url = urlObj.toString();

            // Redirect to the application
            return response.redirect(url);
        } catch (error) {
            if (postInstallUrl) {
                const errorMessage = error.response?.message || error.message || 'Failed to complete OAuth flow';
                const queryParamsString = new URLSearchParams({
                    success: 'false',
                    integration: IntegrationEnum.MakeCom,
                    message: errorMessage
                }).toString();

                const url = `${postInstallUrl}?${queryParamsString}`;
                return response.redirect(url);
            }

            throw new HttpException(
                `Failed to complete OAuth flow with ${IntegrationEnum.MakeCom}: ${error.message}`,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
