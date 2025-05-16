import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import {
	IntegrationEnum,
	IIntegrationEntitySetting,
	IntegrationEntity,
} from '@gauzy/contracts';
import {
	IntegrationService,
	IntegrationSettingService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES
} from '@gauzy/core';
import { MAKE_BASE_URL, MAKE_DEFAULT_SCOPES } from './make-com.config';
import { IMakeComOAuthTokens, MakeSettingName } from './interfaces/make-com.model';
import { MakeComService } from './make-com.service';

@Injectable()
export class MakeComOAuthService {
	private readonly logger = new Logger(MakeComOAuthService.name);
	private pendingStates = new Map<string, { timestamp: number }>();

	constructor(
		private readonly httpService: HttpService,
		private readonly _config: ConfigService,
		private readonly commandBus: CommandBus,
		@Inject(forwardRef(() => MakeComService))
		private readonly makeComService: MakeComService,
		private readonly integrationService: IntegrationService,
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	/**
	 * Generate the authorization URL for the Make.com OAuth flow.
	 *
	 */
	getAuthorizationUrl(options?: { state?: string; clientId?: string; organizationId?: string }): string {
	try {
		const redirectUri = this._config.get('makeCom').redirectUri;
		const tenantId = RequestContext.currentTenantId();
		const organizationId = options?.organizationId;

		// Use provided clientId or fallback to config
		const clientId = options?.clientId || this._config.get('makeCom').clientId;
		if (!clientId) {
			throw new Error('Make.com client ID is not configured');
		}

		// Generate state with encoded tenant and organization data
		const stateData = {
			tenantId,
			organizationId,
			timestamp: Date.now()
		};
		const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

		// Store state for verification (defense against CSRF)
		this.storeStateForVerification(state);

		// Prepare scopes according to Make.com documentation
		const scopes = MAKE_DEFAULT_SCOPES.split(' ').join(',');

		// Build authorization URL according to Make.com documentation
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			state,
			scope: scopes
		});

		return `${MAKE_BASE_URL}/oauth/authorize?${params.toString()}`;
		} catch (error) {
			this.logger.error('Error generating Make.com authorization URL:', error);
			throw error;
		}
	}

	/**
	 * Store the state parameter for later verification.
	 *
	 * @param {string} state - The state parameter to store.
	 */

	/**
	 * TODO: Implement a more robust storage mechanism for state parameters by Q4 2025.
	 * This is a simple in-memory storage for small scale applications.
	 * For scalability, we'll consider using cache, Redis for our case as it already exists in the project.
	 */
	private storeStateForVerification(state: string): void {
		this.pendingStates.set(state, { timestamp: Date.now() });
		this.cleanupExpiredStates();
	}

	/**
	 * Clean up expired state parameters to prevent memory leaks.
	 */
	private cleanupExpiredStates(): void {
		if (!this.pendingStates) return;

		const now = Date.now();
		const expirationTime = 10 * 60 * 1000; // 10 minutes in milliseconds

		for (const [state, { timestamp }] of this.pendingStates.entries()) {
			if (now - timestamp > expirationTime) {
				this.pendingStates.delete(state);
			}
		}
	}

	/**
	 * Exchange the authorization code for access and refresh tokens.
	 *
	 * @param {string} code - The authorization code received from Make.com.
	 * @returns {Promise<any>} The token response.
	 */
	async exchangeCodeForToken(code: string, state: string): Promise<any> {
		try {
			// Decode the state parameter
			const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        	const { tenantId, organizationId } = decodedState;

			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			// Get client credentials from database
			const { clientId, clientSecret } = await this.makeComService.getOAuthCredentials(tenantId, organizationId);
			if (!clientId || !clientSecret) {
				throw new BadRequestException('Make.com OAuth credentials are not fully configured');
			}

			const redirectUri = this._config.get('makeCom').redirectUri;

			if (!clientId || !clientSecret || !redirectUri) {
				throw new BadRequestException('Make.com OAuth credentials are not fully configured');
			}

			// Prepare the request body
			const tokenRequestParams = new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: clientId,
				client_secret: clientSecret,
				code: code,
				redirect_uri: redirectUri
			});

			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded'
			};

			// Make the token request
			const tokenResponse = await firstValueFrom(
				this.httpService.post(`${MAKE_BASE_URL}/api/v2/oauth/token`, tokenRequestParams, { headers }).pipe(
					catchError((error: AxiosError) => {
						this.logger.error('Error while exchanging code for token:', error.response?.data);
						throw new HttpException(
							`Failed to exchange authorization code: ${error.message}`,
							error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
						);
					})
				)
			);

			// Save the tokens in the database
			await this.saveIntegrationSettings(tokenResponse.data);
			return tokenResponse.data;
		} catch (error) {
			this.logger.error('Failed to exchange code for token:', error);
			throw new BadRequestException(`Failed to exchange authorization code: ${error.message}`);
		}
	}

	/**
	 * Save the OAuth tokens as integration settings.
	 *
	 * @param {any} tokenData - The token data from Make.com.
	 * @returns {Promise<void>}
	 */
	private async saveIntegrationSettings(tokenData: IMakeComOAuthTokens, organizationId?: string): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		// organizationId is now passed as parameter instead of trying to get it from tokenData
		try {
			// Find existing Make.com integration or create it if it doesn't exist
			const integration =
				(await this.integrationService.findOneByOptions({
					where: { provider: IntegrationEnum.MakeCom }
				})) || undefined;

			const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
				...entity,
				organizationId,
				tenantId
			}));

			// Prepare entity settings
			const entitySettings = DEFAULT_ENTITY_SETTINGS.map((settingEntity) => {
				if (settingEntity.entity === IntegrationEntity.PROJECT) {
					return {
						...settingEntity,
						tiedEntities
					};
				}
				return {
					...settingEntity,
					organizationId,
					tenantId
				};
			}) as IIntegrationEntitySetting[];

			// Define the settings to save
			const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
			const settings = [
				{
					settingsName: MakeSettingName.ACCESS_TOKEN,
					settingsValue: tokenData.access_token,
					tenantId,
					organizationId
				},
				{
					settingsName: MakeSettingName.REFRESH_TOKEN,
					settingsValue: tokenData.refresh_token,
					tenantId,
					organizationId
				},
				{
					settingsName: MakeSettingName.TOKEN_TYPE,
					settingsValue: tokenData.token_type,
					tenantId,
					organizationId
				},
				{
					settingsName: MakeSettingName.EXPIRES_IN,
					settingsValue: tokenData.expires_in.toString(),
					tenantId,
					organizationId
				},
				{
					settingsName: MakeSettingName.EXPIRES_AT,
					settingsValue: expiresAt,
					tenantId,
					organizationId
				},
				// Maintain the existing webhook settings
				{
					settingsName: MakeSettingName.IS_ENABLED,
					settingsValue: 'true',
					tenantId,
					organizationId
				},
				{
					settingsName: MakeSettingName.WEBHOOK_URL,
					settingsValue: '',
					tenantId,
					organizationId
				}
			];

			// Update or create the integration tenant with new settings
			await this.commandBus.execute(
				new IntegrationTenantUpdateOrCreateCommand(
					{
						name: IntegrationEnum.MakeCom,
						integration: { provider: IntegrationEnum.MakeCom },
						tenantId,
						organizationId
					},
					{
						name: IntegrationEnum.MakeCom,
						integration,
						tenantId,
						organizationId,
						entitySettings,
						settings
					}
				)
			);

			this.logger.log(`Successfully saved ${IntegrationEnum.MakeCom} OAuth tokens for tenant ${tenantId}`);
		} catch (error) {
			this.logger.error(`Failed to save ${IntegrationEnum.MakeCom} OAuth tokens:`, error);
			throw new BadRequestException(`Failed to save integration settings: ${error.message}`);
		}
	}

/**
 * Refreshes the access token for the Make.com integration.
 *
 * @param {string} integrationId - The ID of the integration to refresh the token for.
 * @returns {Promise<void>} A promise that resolves when the token has been refreshed.
 */
async refreshToken(integrationId: string): Promise<void> {
	try {
		// Find the integration setting for refresh token
		const refreshTokenSetting = await this.integrationSettingService.findOneByOptions({
			where: {
				integration: { id: integrationId },
				settingsName: MakeSettingName.REFRESH_TOKEN
			}
		});

		if (!refreshTokenSetting) {
			throw new NotFoundException('Refresh token not found for this integration');
		}

		// Get OAuth credentials from the database
		const { clientId, clientSecret } = await this.makeComService.getOAuthCredentials(integrationId);

		// Get the Make.com token endpoint URL
		const tokenUrl = `${MAKE_BASE_URL}/oauth/token`

		// Create the form data for the token request
		const formData = new URLSearchParams();
		formData.append('grant_type', 'refresh_token');
		formData.append('refresh_token', refreshTokenSetting.settingsValue);
		formData.append('client_id', clientId);
		formData.append('client_secret', clientSecret);

		// Send the token request
		const response = await firstValueFrom(
			this.httpService
				.post(tokenUrl, formData, {
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				})
				.pipe(
					catchError((error: AxiosError) => {
						this.logger.error('Failed to refresh Make.com token:', error.response?.data);
						throw new Error(`Failed to refresh token: ${error.message}`);
					})
				)
		);

		// Extract the new tokens
		const { access_token, refresh_token, expires_in } = response.data;

		// Calculate the expiry time
		const expiresAt = new Date(Date.now() + Number(expires_in) * 1000);

		// Update the integration settings
		// Get the tenant and organization IDs from the existing settings
		const { tenantId, organizationId } = refreshTokenSetting;

		const settingsToUpdate = [
			{
				settingsName: MakeSettingName.ACCESS_TOKEN,
				settingsValue: access_token,
				tenantId,
				organizationId,
				integration: { name: IntegrationEnum.MakeCom }
			},
			{
				settingsName: MakeSettingName.REFRESH_TOKEN,
				settingsValue: refresh_token,
				tenantId,
				organizationId,
				integration: { name: IntegrationEnum.MakeCom }
			},
			{
				settingsName: MakeSettingName.EXPIRES_AT,
				settingsValue: expiresAt.toISOString(),
				tenantId,
				organizationId,
				integration: { name: IntegrationEnum.MakeCom }
			}
		];

		await this.integrationSettingService.bulkUpdateOrCreate(integrationId, settingsToUpdate);

		this.logger.log(`Successfully refreshed token for integration: ${integrationId}`);
	} catch (error) {
		this.logger.error('Error refreshing Make.com token:', error);
		throw error;
	}
}

	/**
	 * Get the access token for a Make.com integration.
	 *
	 * @param {string} integrationId - The ID of the integration.
	 * @returns {Promise<string>} The access token.
	 */
	async getAccessToken(integrationId: string): Promise<string> {
		try {
			const setting = await this.integrationSettingService.findOneByWhereOptions({
				integration: { id: integrationId },
				integrationId,
				settingsName: 'access_token'
			});

			if (!setting || !setting.settingsValue) {
				throw new BadRequestException('Access token not found for this integration');
			}

			return setting.settingsValue;
		} catch (error) {
			throw new BadRequestException(`Failed to get access token: ${error.message}`);
		}
	}
}
