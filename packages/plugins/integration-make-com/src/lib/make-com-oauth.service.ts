import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@gauzy/config';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import { createHash, randomBytes } from 'node:crypto';
import {
	IntegrationEnum,
	IIntegrationEntitySetting,
	IntegrationEntity,
} from '@gauzy/contracts';
import {
	IntegrationService,
	IntegrationSettingService,
	IntegrationTenantService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES,
} from '@gauzy/core';
import { MAKE_BASE_URL, MAKE_DEFAULT_SCOPES } from './make-com.config';
import { IMakeComOAuthTokens, MakeSettingName } from './interfaces/make-com.model';
import { MakeComService } from './make-com.service';

@Injectable()
export class MakeComOAuthService {
	private readonly logger = new Logger(MakeComOAuthService.name);
	private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 min
	private static readonly STATE_CACHE_KEY_PREFIX = 'make_com_oauth_state:';

	constructor(
		private readonly httpService: HttpService,
		private readonly config: ConfigService,
		private readonly makeComService: MakeComService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationService: IntegrationService,
		private readonly commandBus: CommandBus,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache
	) {}

	/**
	 * Generate a cryptographically secure random code verifier for PKCE.
	 */
	private generateCodeVerifier(): string {
		return randomBytes(32).toString('base64url');
	}

	/**
	 * Generate code challenge from code verifier using SHA256.
	 */
	private generateCodeChallenge(codeVerifier: string): string {
		return createHash('sha256').update(codeVerifier).digest('base64url');
	}

	/**
	 * Generate the authorization URL for the Make.com OAuth v2 flow with PKCE.
	 * Make.com requires code_challenge even for confidential clients.
	 *
	 * @see https://developers.make.com/api-documentation/authentication/oauth-flow/authorization-code-flow-with-refresh-token-confidential-clients
	 */
	async getAuthorizationUrl(options?: { state?: string; clientId?: string; organizationId?: string }): Promise<string> {
	try {
		const redirectUri = this.config.get('makeCom').redirectUri;
		const tenantId = RequestContext.currentTenantId();
		const organizationId = options?.organizationId;

		// Use provided clientId or fallback to config
		const clientId = options?.clientId || this.config.get('makeCom').clientId;
		if (!clientId) {
			throw new Error('Make.com client ID is not configured');
		}

		// Always generate state internally to ensure consistent format
		const state = Buffer.from(JSON.stringify({ tenantId, organizationId })).toString('base64url');

		// Generate PKCE parameters (required by Make.com OAuth v2)
		const codeVerifier = this.generateCodeVerifier();
		const codeChallenge = this.generateCodeChallenge(codeVerifier);

		// Store state in Redis for later verification (async to ensure persistence)
		await this.storeStateForVerification(state, codeVerifier);

		// Prepare scopes according to Make.com documentation
		const scopes = MAKE_DEFAULT_SCOPES.join(' ');

		// Build authorization URL per Make.com OAuth v2 documentation
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			state,
			scope: scopes,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256'
		});

		return `${MAKE_BASE_URL}/oauth/v2/authorize?${params.toString()}`;
		} catch (error) {
			this.logger.error('Error generating Make.com authorization URL:', error);
			throw error;
		}
	}

	async exchangeCodeForToken(code: string, state: string, codeVerifier?: string): Promise<IMakeComOAuthTokens> {
		try {
			// Decode the state parameter
			const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString());
			const { tenantId, organizationId } = decodedState;

			// Read client credentials from server-side config (env vars) — never from tenant data
			const makeComConfig = this.config.get('makeCom');
			const clientId = makeComConfig?.clientId;
			const clientSecret = makeComConfig?.clientSecret;

			if (!clientId || !clientSecret) {
				throw new BadRequestException('Make.com OAuth credentials are not configured on the server');
			}

			if (!codeVerifier) {
				throw new BadRequestException('Missing PKCE code verifier for token exchange');
			}

			// Prepare the request body for Make.com token endpoint with PKCE
			const redirectUri = makeComConfig?.redirectUri;

			const tokenRequestParams = new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				client_id: clientId,
				client_secret: clientSecret,
				code_verifier: codeVerifier,
				...(redirectUri ? { redirect_uri: redirectUri } : {})
			});

			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			};

			// Make the token request to Make.com OAuth v2 token endpoint
			const tokenResponse = await firstValueFrom(
				this.httpService.post(`${MAKE_BASE_URL}/oauth/v2/token`, tokenRequestParams, { headers, timeout: 10000 }).pipe(
					catchError((error: AxiosError) => {
						this.logger.error('Error while exchanging code for token:', error.response?.data);
						throw new HttpException(
							`Failed to exchange authorization code: ${error.message}`,
							error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
						);
					})
				)
			);

			if (!tokenResponse.data.access_token) {
				throw new BadRequestException('Invalid token response from Make.com');
			}

			// Save the tokens in the database
			await this.saveIntegrationSettings(tokenResponse.data, tenantId, organizationId);
			return tokenResponse.data;
		} catch (error) {
			this.logger.error('Failed to exchange code for token:', error);
			throw new BadRequestException(`Failed to exchange authorization code: ${error.message}`);
		}
	}

	/**
	 * Get integration tenant by tenantId and organizationId
	 */
	private async getIntegrationTenant(tenantId: string, organizationId?: string) {
		return await this.integrationTenantService.findOneByOptions({
			where: {
				name: IntegrationEnum.MakeCom,
				tenantId,
				...(organizationId && { organizationId })
			},
			relations: ['settings']
		});
	}

	/**
	 * Get setting value from integration tenant
	 */
	private async getSettingValue(integrationTenant: any, settingName: string): Promise<string | null> {
		if (!integrationTenant || !integrationTenant.settings) {
			return null;
		}
		const setting = integrationTenant.settings.find((s: any) => s.settingsName === settingName);
		return setting ? setting.settingsValue : null;
	}

	/**
	 * Save the OAuth tokens as integration settings.
	 */
	private async saveIntegrationSettings(tokenData: IMakeComOAuthTokens, tenantId: string, organizationId?: string): Promise<void> {
		try {
			// Find existing Make.com integration or create it if it doesn't exist
			const integration = await this.integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.MakeCom }
			});

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
	 * Verify the state parameter to prevent CSRF attacks and return the PKCE code verifier.
	 * Uses Redis-backed cache for multi-replica support and process restart durability.
	 */
	async verifyState(state: string): Promise<{ isValid: boolean; codeVerifier?: string }> {
		const cacheKey = MakeComOAuthService.STATE_CACHE_KEY_PREFIX + state;
		const pendingState = await this.cacheManager.get<{ timestamp: number; codeVerifier: string }>(cacheKey);

		if (!pendingState) {
			this.logger.warn(`State ${state} not found in pending states`);
			return { isValid: false };
		}

		// State found - delete it immediately to ensure single-use (atomic consumption)
		await this.cacheManager.del(cacheKey);

		// Check expiration by reading the stored timestamp
		const now = Date.now();
		const expirationTime = MakeComOAuthService.STATE_TTL_MS;
		if (now - pendingState.timestamp > expirationTime) {
			this.logger.warn(`State ${state} has expired`);
			return { isValid: false };
		}

		// Valid and not expired - return codeVerifier for token exchange
		return { isValid: true, codeVerifier: pendingState.codeVerifier };
	}

	/**
	 * Store the state parameter and PKCE code verifier for later verification.
	 * Uses Redis-backed cache with TTL for multi-replica support and process restart durability.
	 *
	 * @param {string} state - The state parameter to store.
	 * @param {string} codeVerifier - The PKCE code verifier to store.
	 */
	private async storeStateForVerification(state: string, codeVerifier: string): Promise<void> {
		const cacheKey = MakeComOAuthService.STATE_CACHE_KEY_PREFIX + state;
		// TTL in seconds (cache-manager expects seconds, not milliseconds)
		const ttlInSeconds = MakeComOAuthService.STATE_TTL_MS / 1000;
		await this.cacheManager.set(cacheKey, { timestamp: Date.now(), codeVerifier }, ttlInSeconds);
	}

	/**
	 * Clean up expired state parameters.
	 * Note: With Redis-backed cache and TTL, this is no longer needed as Redis handles expiration automatically.
	 * Kept for backward compatibility but does nothing.
	 */
	private cleanupExpiredStates(): void {
		// Redis TTL handles expiration automatically - no manual cleanup needed
	}

	/**
	 * Handles the callback from Make.com OAuth flow.
	 * Verifies the state parameter and exchanges the authorization code for tokens using PKCE.
	 */
	async handleAuthorizationCallback(code: string, state: string): Promise<void> {
		try {
			// Verify state to prevent CSRF and retrieve the PKCE code verifier
			const stateVerification = await this.verifyState(state);
			if (!stateVerification.isValid) {
				throw new BadRequestException('Invalid or expired state parameter');
			}

			// Exchange the authorization code for tokens with the PKCE code verifier
			await this.exchangeCodeForToken(code, state, stateVerification.codeVerifier);
			this.logger.log('Successfully handled OAuth callback and exchanged code for tokens');
		} catch (error) {
			this.logger.error('Error handling Make.com authorization callback:', error);
			throw error;
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

			// Read OAuth credentials from server-side config (env vars) — never from tenant data
			const makeComConfig = this.config.get('makeCom');
			const clientId = makeComConfig?.clientId;
			const clientSecret = makeComConfig?.clientSecret;

			if (!clientId || !clientSecret) {
				throw new BadRequestException('Make.com OAuth credentials are not configured on the server');
			}

			// Get the Make.com OAuth v2 token endpoint URL
			const tokenUrl = `${MAKE_BASE_URL}/oauth/v2/token`;

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
							throw new HttpException(`Failed to refresh token: ${error.message}`, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
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
				settingsName: MakeSettingName.ACCESS_TOKEN
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
