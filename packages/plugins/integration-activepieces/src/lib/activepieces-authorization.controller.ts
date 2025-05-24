import {  Get, Query, Res, HttpException, HttpStatus, Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { ActivepiecesOAuthService } from './activepieces-oauth.service';

@ApiTags('Activepieces OAuth')
@Public()
@Controller('./integration/activepieces/oauth')
export class ActivepiecesAuthorizationController {
    constructor(
        private readonly _config: ConfigService,
        private readonly activepiecesOAuthService: ActivepiecesOAuthService
    ) { }

    /**
     * Initiates the OAuth 2.0 authorization flow with Activepieces.
     * Redirects the user to the Activepieces authorization page.
     * @param {Response} response - Express Response object.
     */
    @ApiOperation({ summary: 'Initiate OAuth 2.0 flow with Activepieces' })
    @ApiResponse({
        status: 302,
        description: 'Redirects to Activepieces authorization page'
    })
    @Get('/authorize')
    async authorize(@Query() { state }: { state?: string }, @Res() response: Response) {
        try {
            const authorizationUrl = this.activepiecesOAuthService.getAuthorizationUrl(state);
            return response.redirect(authorizationUrl);
        } catch (error: any) {
            throw new HttpException(
                `Failed to initiate OAuth flow with ${IntegrationEnum.ACTIVE_PIECES}: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Handles the callback from Activepieces after user authorization.
     * Exchanges the authorization code for access and refresh tokens.
     * @param {object} query - The query parameters from the callback.
     * @param {Response} response - Express Response object.
     */
    @ApiOperation({ summary: 'Handle Activepieces OAuth callback' })
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
        const postInstallUrl = this._config.get<string>('activepieces.postInstallUrl');
        try {
            // Validate the input data
            if (!code) {
                throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
            }
            // Validate state parameter - required for CSRF protection
            if (!state) {
                throw new HttpException(
                    'Invalid state parameter - required for CSRF protection',
                    HttpStatus.BAD_REQUEST
                );
            }
            // Verify state parameter minimum length
            if (state.length < 32) {
                throw new HttpException(
                    'Invalid state parameter - minimum length is 32 characters',
                    HttpStatus.BAD_REQUEST
                );
            }
            // Exchange the authorization code for access token
            const tokenResponse = await this.activepiecesOAuthService.exchangeCodeForToken(code, state);

            // Check if the token exchange was successful
            if (!tokenResponse || !tokenResponse.access_token) {
                throw new HttpException(
                    'Failed to exchange authorization code for access token',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            if (!postInstallUrl) {
                throw new HttpException(
                    'Post-installation URL is not configured',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            // Create succes redirect URL
            const urlObj = new URL(postInstallUrl);
            urlObj.searchParams.set('success', 'true');
            urlObj.searchParams.set('integration', IntegrationEnum.ACTIVE_PIECES);
            urlObj.searchParams.set('message', 'Integration added successfully');
            const url = urlObj.toString();

            // Redirect to the applcation
            return response.redirect(url);

        } catch (error: any) {
            if (postInstallUrl) {
                const errorMessage = 'Failed to complete OAuth flow';
                const queryParamsString = buildQueryString({
                    success: 'false',
                    integration: IntegrationEnum.ACTIVE_PIECES,
                    message: errorMessage
                });
                const url = [postInstallUrl, queryParamsString].filter(Boolean).join('?');
                return response.redirect(url);
            }
            throw new HttpException(
                `Failed to add ${IntegrationEnum.ACTIVE_PIECES} integration: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
