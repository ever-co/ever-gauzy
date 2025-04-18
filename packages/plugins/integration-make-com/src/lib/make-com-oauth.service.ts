import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
	IntegrationEnum,
	IIntegrationEntitySetting,
	IIntegrationSetting,
	MakeSettingName,
	IMakeComOAuthTokens,
	IntegrationEntity,
	ID
} from '@gauzy/contracts';
import {
	IntegrationService,
	IntegrationSettingService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
    PROJECT_TIED_ENTITIES
} from '@gauzy/core';
import { MAKE_BASE_URL } from './make-com.config';
import { DeepPartial } from 'typeorm';


@Injectable()
export class MakeComOAuthService {
	private readonly logger = new Logger(MakeComOAuthService.name);
	private pendingStates = new Map<string, { timestamp: number }>();

	constructor(
		private readonly httpService: HttpService,
		private readonly _config: ConfigService,
		private readonly commandBus: CommandBus,
		private readonly integrationService: IntegrationService,
		private readonly integrationSettingService: IntegrationSettingService,
	) {}

	/**
	 * Generate the authorization URL for the Make.com OAuth flow.
	 *
	 * @param {string} [stateOverride] - Optional override for the state parameter.
	 * @returns {string} The authorization URL to redirect the user to.
	 */
	getAuthorizationUrl(stateOverride?: string): string {
		const clientId = this._config.get<string>('makeCom.clientId');
		if (!clientId) {
			throw new BadRequestException('Make.com client ID is not configured');
		}

		const redirectUri = this._config.get<string>('makeCom.redirectUri');
		if (!redirectUri) {
			throw new BadRequestException('Make.com redirect URI is not configured');
		}

		// Generate a random state parameter
		// The state parameter is required by Make.com to prevent CSRF attacks and should be verified during the callback
		const state = stateOverride || this.generateRandomState();

		// Store the state in memory or some other storage mechanism
		// This is used to verify the state parameter during the callback
		this.storeStateForVeriification(state);

		// Build the authorization URL with required parameters
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: 'offline_access',
			state
		});

		return `${MAKE_BASE_URL}/oauth/authorize?${params.toString()}`;
	}

	/**
	 * Generate a random state parameter.
	 *
	 * @returns {string} A random string to use as the state parameter.
	 * This helps to prevent CSRF attacks during the OAuth flow.
	 */
	private generateRandomState(): string {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}

	/**
	 * Store the state parameter for later verification.
	 *
	 * @param {string} state - The state parameter to store.
	 */

	/**
	 * TODO: Implement a more robust storage mechanism for state parameters
	 * This is a simple in-memory storage for small scale applications
	 * For scalability, we'll consider using cache, Redis for our case as it already exists in the project
	 */
	private	storeStateForVeriification(state: string): void {
		// In a real implementation, you would store the state in a database or some other storage mechanism like cache or redis
		if (!this.pendingStates) {
			this.pendingStates = new Map<string, { timestamp: number }>();
		}
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
	async exchangeCodeForToken(code: string, state?: string): Promise<any> {
		try {
			// Verify the state parameter if provided
			if (state && !this.verifyState(state)) {
				throw new BadRequestException('Invalid state parameter - possible CSRF attack');
			}
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			const clientId = this._config.get<string>('makeCom.clientId');
			const clientSecret = this._config.get<string>('makeCom.clientSecret');
			const redirectUri = this._config.get<string>('makeCom.redirectUri');

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
				this.httpService.post(`${MAKE_BASE_URL}/oauth/token`, tokenRequestParams, { headers }).pipe(
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
	 * Verify  the state parameter to prevent CSRF attacks.
	 *
	 * @param {string} state - The state parameter to verify.
	 * @returns {boolean} True if the state parameter is valid, false otherwise.
	 */
	private	verifyState(state: string): boolean {
		if (!this.pendingStates) {
			this.logger.warn('No pending states found for verification');
			return false;
		}

		const pendingState = this.pendingStates.get(state);
		if(!pendingState) {
			this.logger.warn(`State ${state} not found in pending states`);
			return false;
		}
		const now = Date.now();
		const expirationTime = 10 * 60 * 1000; // 10 minutes in milliseconds
		if (now - pendingState.timestamp > expirationTime) {
			this.logger.warn(`State ${state} has expired`);
			this.pendingStates.delete(state);
			return false;
		}
		return true;
	}

	/**
	 * Save the OAuth tokens as integration settings.
	 *
	 * @param {any} tokenData - The token data from Make.com.
	 * @returns {Promise<void>}
	 */
	private async saveIntegrationSettings(tokenData: IMakeComOAuthTokens): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = tokenData;
		try {
			// Find existing Make.com integration or create it if it doesn't exist
			const integration = (await this.integrationService.findOneByOptions({
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
			const settings = [
				{
					settingsName: 'access_token',
					settingsValue: tokenData.access_token,
					tenantId,
					organizationId
				},
				{
					settingsName: 'refresh_token',
					settingsValue: tokenData.refresh_token,
					tenantId,
					organizationId
				},
				{
					settingsName: 'token_type',
					settingsValue: tokenData.token_type,
					tenantId,
					organizationId
				},
				{
					settingsName: 'expires_in',
					settingsValue: tokenData.expires_in.toString(),
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
	 * Refresh the access token using the refresh token.
	 *
	 * @param {string} integrationId - The ID of the integration.
	 * @returns {Promise<any>} The new token data.
	 */
	async refreshToken(integrationId: ID): Promise<any> {
		try {
			// Find the refresh token in the integration settings
			const settings = await this.integrationSettingService.find({
				where: {
					integration: { id: integrationId },
					integrationId
				}
			});

			const refreshToken = settings.find(setting => setting.settingsName === 'refresh_token')?.settingsValue;
			if (!refreshToken) {
				throw new BadRequestException('Refresh token not found');
			}

			const clientId = this._config.get<string>('makeCom.clientId');
			const clientSecret = this._config.get<string>('makeCom.clientSecret');

			if (!clientId || !clientSecret) {
				throw new BadRequestException('Make.com OAuth credentials are not fully configured');
			}

			// Prepare the request body
			const refreshParams = new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: refreshToken
			});

			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded'
			};

			// Make the token refresh request
			const response = await firstValueFrom(
				this.httpService.post(`${MAKE_BASE_URL}/oauth/token`, refreshParams, { headers }).pipe(
					catchError((error: AxiosError) => {
						this.logger.error('Error while refreshing token:', error.response?.data);
						throw new HttpException(
							`Failed to refresh token: ${error.message}`,
							error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
						);
					})
				)
			);

			// Update the tokens in the database
			const tenantId = RequestContext.currentTenantId();

			const tokenData = response.data;
			const updatedSettings = settings.map(setting => {
				if (setting.settingsName === 'access_token') {
					setting.settingsValue = tokenData.access_token;
				}
				if (setting.settingsName === 'refresh_token') {
					setting.settingsValue = tokenData.refresh_token;
				}
				if (setting.settingsName === 'expires_in') {
					setting.settingsValue = tokenData.expires_in.toString();
				}
				return {
					...setting,
					tenantId,
				};
			}) as DeepPartial<IIntegrationSetting>[];

			await this.integrationSettingService.create(updatedSettings);

			return response.data;
		} catch (error) {
			this.logger.error('Failed to refresh token:', error);
			throw new BadRequestException(`Failed to refresh token: ${error.message}`);
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

			return setting.settingsValue;
		} catch (error) {
			throw new BadRequestException(`Failed to get access token: ${error.message}`);
		}
	}
}
