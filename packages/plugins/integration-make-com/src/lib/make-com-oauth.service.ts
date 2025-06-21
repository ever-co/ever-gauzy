import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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
	private pendingStates = new Map<string, { timestamp: number; codeVerifier?: string }>();
	private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 min

	constructor(
		private readonly httpService: HttpService,
		private readonly config: ConfigService,
		private readonly makeComService: MakeComService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationService: IntegrationService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Generate a cryptographically secure random code verifier for PKCE
	 */
	private generateCodeVerifier(): string {
		return randomBytes(32).toString('base64url');
	}

	/**
	 * Generate code challenge from code verifier using SHA256
	 */
	private generateCodeChallenge(codeVerifier: string): string {
		return createHash('sha256').update(codeVerifier).digest('base64url');
	}

	/**
	 * Generate the authorization URL for the Make.com OAuth flow with PKCE support.
	 *
	 */
	getAuthorizationUrl(options?: { state?: string; clientId?: string; organizationId?: string }): string {
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

		// Generate PKCE parameters
		const codeVerifier = this.generateCodeVerifier();
		const codeChallenge = this.generateCodeChallenge(codeVerifier);

		this.storeStateForVerification(state, codeVerifier);

		// Prepare scopes according to Make.com documentation
		const scopes = MAKE_DEFAULT_SCOPES.join(' ');

		// Build authorization URL according to Make.com documentation with PKCE
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			state,
			scope: scopes,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256'
		});

		return `${MAKE_BASE_URL}/oauth/authorize?${params.toString()}`;
		} catch (error) {
			this.logger.error('Error generating Make.com authorization URL:', error);
			throw error;
		}
	}

	async exchangeCodeForToken(code: string, state: string): Promise<IMakeComOAuthTokens> {
		try {
			const stateVerification = this.verifyState(state);
			if (!stateVerification.isValid) {
				throw new BadRequestException('Invalid state parameter');
			}

			// Decode the state parameter
			const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString());
			const { tenantId, organizationId } = decodedState;

			// Set the tenant context for subsequent operations
			const currentTenantId = RequestContext.currentTenantId();
			if (currentTenantId !== tenantId) {
				throw new BadRequestException('Tenant ID mismatch');
			}

			// Get client credentials from database
			const integrationTenant = await this.getIntegrationTenant(tenantId, organizationId);
			const clientId = await this.getSettingValue(integrationTenant, MakeSettingName.CLIENT_ID);
			const clientSecret = await this.getSettingValue(integrationTenant, MakeSettingName.CLIENT_SECRET);

			if (!clientId || !clientSecret) {
				throw new BadRequestException('Make.com OAuth credentials are not fully configured');
			}

			const redirectUri = this.config.get('makeCom').redirectUri;

			// Prepare the request body for Make.com token endpoint with PKCE
			const tokenRequestParams = new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUri,
				client_id: clientId,
				client_secret: clientSecret
			});

			// Add code verifier for PKCE if available
			if (!stateVerification.codeVerifier) {
				throw new BadRequestException('Missing PKCE code verifier');
			}
			tokenRequestParams.append('code_verifier', stateVerification.codeVerifier);

			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			};

			// Make the token request to Make.com
			const tokenResponse = await firstValueFrom(
				this.httpService.post(`${MAKE_BASE_URL}/oauth/token`, tokenRequestParams, { headers, timeout: 10000 }).pipe(
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
	 * Verify the state parameter to prevent CSRF attacks and return code verifier for PKCE.
	 */
	verifyState(state: string): { isValid: boolean; codeVerifier?: string } {
		const pendingState = this.pendingStates.get(state);

		if (!pendingState) {
			this.logger.warn(`State ${state} not found in pending states`);
			return { isValid: false };
		}
		const now = Date.now();
		const expirationTime = MakeComOAuthService.STATE_TTL_MS;
		if (now - pendingState.timestamp > expirationTime) {
			this.logger.warn(`State ${state} has expired`);
			this.pendingStates.delete(state);
			return { isValid: false };
		}
		// Valid and used - remove it to free memory and return the code verifier
		this.pendingStates.delete(state);
		return { isValid: true, codeVerifier: pendingState.codeVerifier };
	}

	/**
	 * Store the state parameter and code verifier for later verification.
	 *
	 * @param {string} state - The state parameter to store.
	 * @param {string} codeVerifier - The PKCE code verifier to store.
	 */

	/**
	 * TODO: Implement a more robust storage mechanism for state parameters by Q4 2025.
	 * This is a simple in-memory storage for small scale applications.
	 * For scalability, we'll consider using cache, Redis for our case as it already exists in the project.
	 */
	private storeStateForVerification(state: string, codeVerifier?: string): void {
		this.pendingStates.set(state, { timestamp: Date.now(), codeVerifier });
		this.cleanupExpiredStates();
	}

	/**
	 * Clean up expired state parameters to prevent memory leaks.
	 */
	private cleanupExpiredStates(): void {
		const now = Date.now();
		const expirationTime = MakeComOAuthService.STATE_TTL_MS;

		for (const [state, { timestamp }] of this.pendingStates.entries()) {
			if (now - timestamp > expirationTime) {
				this.pendingStates.delete(state);
			}
		}
	}

	/**
	 * Handles the callback from Make.com OAuth flow
	 * This method stores information for future use
	 */
	async handleAuthorizationCallback(code: string, state: string): Promise<void> {
		try {
			// Decode the state to get context
			const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
			const { organizationId, tenantId } = decodedState;

			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					name: IntegrationEnum.MakeCom,
					tenantId,
					...(organizationId && { organizationId })
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				this.logger.warn(`Integration not found for tenant ${tenantId}`);
				throw new NotFoundException('Integration not found');
			}

			// Store the authorization code
			// but since Make.com handles the OAuth flow, we just store the fact
			// that the integration was authorized
			let authCodeSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.AUTH_CODE
			);

			if (authCodeSetting) {
				authCodeSetting.settingsValue = code;
			} else {
				authCodeSetting = await this.integrationSettingService.create({
					settingsName: MakeSettingName.AUTH_CODE,
					settingsValue: code,
					integrationId: integrationTenant.id,
					tenantId: integrationTenant.tenantId,
					organizationId: integrationTenant.organizationId
				});
			}

			await this.integrationSettingService.save(authCodeSetting);

			// Set integration as enabled
			let enabledSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
			);

			if (enabledSetting) {
				enabledSetting.settingsValue = 'true';
			} else {
				enabledSetting = await this.integrationSettingService.create({
					settingsName: MakeSettingName.IS_ENABLED,
					settingsValue: 'true',
					integrationId: integrationTenant.id,
					tenantId: integrationTenant.tenantId,
					organizationId: integrationTenant.organizationId
				});
			}
			await this.integrationSettingService.save(enabledSetting);
			this.logger.log(`Successfully handled OAuth callback for tenant ${tenantId}`);
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

			// Get OAuth credentials from the database
			const { clientId, clientSecret } = await this.makeComService.getOAuthCredentials(integrationId);

			// Get the Make.com token endpoint URL
			const tokenUrl = `${MAKE_BASE_URL}/oauth/token`;

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
