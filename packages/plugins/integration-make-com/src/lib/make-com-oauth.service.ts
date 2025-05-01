import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import { DeepPartial } from 'typeorm';
import {
	IntegrationEnum,
	IIntegrationEntitySetting,
	IIntegrationSetting,
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
import { IMakeComOAuthTokens, MakeSettingName } from './interfaces/make-com.model';
import { randomBytes } from 'node:crypto';
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
		this.storeStateForVerification(state);

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
		return randomBytes(16).toString('hex'); // import { randomBytes } from 'crypto';
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
	private verifyState(state: string): boolean {
		const pendingState = this.pendingStates.get(state);

		if (!pendingState) {
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
		// Valid and used - remove it to free memory
		this.pendingStates.delete(state);
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
		const organizationId = tokenData.organizationId;
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
		const expiresAt = new Date();
		expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

		// Update the integration settings
		const settingsToUpdate = [
			{
				settingsName: MakeSettingName.ACCESS_TOKEN,
				settingsValue: access_token,
				integration: { name: IntegrationEnum.MakeCom }
			},
			{
				settingsName: MakeSettingName.REFRESH_TOKEN,
				settingsValue: refresh_token,
				integration: { name: IntegrationEnum.MakeCom }
			},
			{
				settingsName: MakeSettingName.EXPIRES_IN,
				settingsValue: expiresAt.toISOString(),
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
