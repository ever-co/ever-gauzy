import { Controller, Get, Query, Res, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { MakeComOAuthService } from './make-com-oauth.service';

@ApiTags('Make.com OAuth')
@Public()
@Controller('/integration/make-com/oauth')
export class MakeComAuthorizationController {
    constructor(
        private readonly config: ConfigService,
        private readonly makeComOAuthService: MakeComOAuthService
    ) {}

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
    async authorize(@Query() { state }: { state?: string }) {
        return {
            authorizationUrl: this.makeComOAuthService.getAuthorizationUrl({ state })
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
        @Query() { code, state, error, error_description }: { code?: string; state?: string, error?: string; error_description?: string },
        @Res() response: Response
    ) {
        // Get the post-installation redirect URL from config
        const postInstallUrl = this.config.get('makeCom')?.postInstallUrl;
        if (!postInstallUrl) {
            throw new HttpException('postInstallUrl not found in config', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            // Handle error from Make.com
            if (error) {
                throw new BadRequestException(`OAuth error ${error} - ${error_description || 'No description provided'}`)
            }
            // Validate required data
            if (!code || !state) {
                throw new BadRequestException('Missing required parameters: code and state')
            }

            // Exchange the authorization code for access token - this now simply stores the token
            // We don't exchange it ourselves, Make does that for us
            await this.makeComOAuthService.handleAuthorizationCallback(code, state);

            // Build successful URL with access token
            const urlObj = new URL(postInstallUrl);
            urlObj.searchParams.set('success', 'true');
            urlObj.searchParams.set('integration', IntegrationEnum.MakeCom);
            urlObj.searchParams.set('message', 'Integration connected successfully');

            // Redirect to the application
            return response.redirect(urlObj.toString());
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
