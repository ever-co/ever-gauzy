import { BadRequestException, Controller, Get, HttpException, HttpStatus, Logger, Query, Res } from '@nestjs/common';
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
	@Get('/oauth/callback')
	async callback(@Query() query: any, @Res() res: Response) {
		try {
			if (!query || !query.code || !query.state) {
				throw new BadRequestException('Authorization code is required');
			}
			const postInstallUrl = this._config.get('zapier')?.postInstallUrl;
			// Parse state to get stored information (tenant, org, integration IDs)
			const stateData = this.zapierService.parseAuthState(query.state);

			// Complete the OAuth flow by exchanging the code for tokens
			const integration = await this.zapierService.completeOAuthFlow(query.code, stateData);
			// convert query params object to string
			const queryParamsString = buildQueryString({
				code: query.code,
				state: query.state
			});
			// Combine hubstaff post install URL with query params
			const url = [postInstallUrl, queryParamsString].filter(Boolean).join('?');

			return res.redirect(url);
		} catch (error: any) {
			throw new HttpException(
				`Failed to add ${IntegrationEnum.ZAPIER} integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
