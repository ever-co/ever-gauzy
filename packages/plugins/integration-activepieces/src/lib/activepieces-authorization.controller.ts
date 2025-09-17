import { Controller, Get, Post, Body, HttpException, HttpStatus, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { Public, IActivepiecesConfig } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { buildQueryString } from '@gauzy/utils';
import { firstValueFrom, catchError } from 'rxjs';
import { ACTIVEPIECES_OAUTH_AUTHORIZE_URL, ACTIVEPIECES_OAUTH_TOKEN_URL, ACTIVEPIECES_SCOPES, OAUTH_RESPONSE_TYPE, OAUTH_GRANT_TYPE } from './activepieces.config';
import { ActivepiecesQueryDTO } from './dto/activepieces-query.dto';
import { IActivepiecesTokenExchangeRequest, IActivepiecesOAuthTokens } from './activepieces.type';

@ApiTags('ActivePieces Integration')
@Public()
@Controller('/integration/activepieces')
export class ActivepiecesAuthorizationController {
	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService
	) {}

	/**
	 * Generate a random state parameter for CSRF protection
	 *
	 * @returns {string} Random state string
	 */
	private generateState(): string {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}
	/**
	 * Initiate OAuth authorization flow with ActivePieces
	 *
	 * @param {any} query - Query parameters including state
	 * @param {Response} response - Express Response object
	 */
	@ApiOperation({ summary: 'Initiate OAuth flow with ActivePieces' })
	@ApiResponse({
		status: 200,
		description: 'Returns the ActivePieces authorization URL',
		schema: {
			type: 'object',
			properties: {
				authorizationUrl: {
					type: 'string',
					description: 'The URL to redirect the user to for authorization'
				},
				state: {
					type: 'string',
					description: 'The state parameter for CSRF protection'
				}
			}
		}
	})
	@Get('/authorize')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async authorize(@Query() query: ActivepiecesQueryDTO, @Res() response: Response) {
		try {
			// Get ActivePieces configuration
			const activepiecesConfig = this.configService.get('activepieces') as IActivepiecesConfig;

			if (!activepiecesConfig?.clientId || !activepiecesConfig?.callbackUrl) {
				throw new HttpException('ActivePieces configuration is incomplete', HttpStatus.INTERNAL_SERVER_ERROR);
			}

			// Generate state parameter for CSRF protection if not provided
			const state = query.state || this.generateState();

			// Build authorization URL parameters
			const authParams = new URLSearchParams({
				client_id: activepiecesConfig.clientId,
				redirect_uri: activepiecesConfig.callbackUrl,
				response_type: OAUTH_RESPONSE_TYPE,
				scope: ACTIVEPIECES_SCOPES,
				state: state
			});

			// Construct the full authorization URL
			const authorizationUrl = `${ACTIVEPIECES_OAUTH_AUTHORIZE_URL}?${authParams.toString()}`;

			// Return the authorization URL in JSON format instead of redirecting
			return response.json({
				authorizationUrl,
				state
			});
		} catch (error: any) {
			throw new HttpException(
				`Failed to initiate ${IntegrationEnum.ACTIVE_PIECES} authorization: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Handle the callback from ActivePieces after user authorization
	 *
	 * @param {any} query - The query parameters from the callback
	 * @param {Response} response - Express Response object
	 */
	@ApiOperation({ summary: 'Handle ActivePieces OAuth callback' })
	@ApiResponse({
		status: 302,
		description: 'Redirects to the application with authorization code'
	})
	@Get('/callback')
	async callback(@Query() query: ActivepiecesQueryDTO, @Res() response: Response) {
		try {
			// Validate the input data
			if (!query || !query.code || !query.state) {
				throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
			}

			// Get ActivePieces configuration for post-install URL
			const activepiecesConfig = this.configService.get('activepieces') as IActivepiecesConfig;

			if (!activepiecesConfig?.postInstallUrl) {
				throw new HttpException(
					'ActivePieces post-install URL is not configured',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			// Convert query params object to string
			const queryParamsString = buildQueryString({
				code: query.code,
				state: query.state,
				integration: IntegrationEnum.ACTIVE_PIECES
			});

			// Combine post install URL with query params
			const redirectUrl = [activepiecesConfig.postInstallUrl, queryParamsString].filter(Boolean).join('?');

			// Redirect to the application with the authorization code
			return response.redirect(redirectUrl);
		} catch (error: any) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to handle ${IntegrationEnum.ACTIVE_PIECES} callback: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Exchange authorization code for access token
	 *
	 * @param {IActivepiecesTokenExchangeRequest} body - Token exchange request
	 */
	@ApiOperation({ summary: 'Exchange authorization code for access token' })
	@ApiResponse({
		status: 200,
		description: 'Returns OAuth tokens',
		schema: {
			type: 'object',
			properties: {
				access_token: { type: 'string' },
				refresh_token: { type: 'string' },
				token_type: { type: 'string' },
				expires_in: { type: 'number' },
				scope: { type: 'string' }
			}
		}
	})
	@Post('/token')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async exchangeToken(@Body() body: IActivepiecesTokenExchangeRequest): Promise<IActivepiecesOAuthTokens> {
		try {
			// Get ActivePieces configuration
			const activepiecesConfig = this.configService.get('activepieces') as IActivepiecesConfig;

			if (!activepiecesConfig?.clientId || !activepiecesConfig?.clientSecret) {
				throw new HttpException('ActivePieces OAuth credentials are not configured', HttpStatus.INTERNAL_SERVER_ERROR);
			}

			// Prepare token exchange request
			const tokenRequest: IActivepiecesTokenExchangeRequest = {
				code: body.code,
				client_id: activepiecesConfig.clientId,
				client_secret: activepiecesConfig.clientSecret,
				redirect_uri: activepiecesConfig.callbackUrl,
				grant_type: OAUTH_GRANT_TYPE.AUTHORIZATION_CODE
			};

			// Exchange authorization code for access token
			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesOAuthTokens>(ACTIVEPIECES_OAUTH_TOKEN_URL, tokenRequest, {
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded'
						}
					})
					.pipe(
						catchError((error) => {
							const status = error?.response?.status;
							const data = error?.response?.data;
							const errorMessage = data?.error_description || data?.error || error.message;

							throw new HttpException(
								`Failed to exchange authorization code: ${errorMessage}`,
								status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to exchange ${IntegrationEnum.ACTIVE_PIECES} authorization code: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
