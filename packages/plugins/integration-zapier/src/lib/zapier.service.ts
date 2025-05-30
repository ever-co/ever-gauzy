import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError, AxiosResponse } from 'axios';
import { DeepPartial } from 'typeorm';
import { catchError, firstValueFrom, map } from 'rxjs';
import { ConfigService } from '@gauzy/config';
import {
	IIntegrationTenant,
	IntegrationEnum,
	IntegrationEntity,
	IIntegrationSetting,
	IIntegrationEntitySetting,
	ID
} from '@gauzy/contracts';
import {
	IntegrationSettingService,
	IntegrationService,
	IntegrationTenantUpdateOrCreateCommand,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES,
	RequestContext
} from '@gauzy/core';
import { ZAPIER_API_URL, ZAPIER_BASE_URL, ZAPIER_TOKEN_EXPIRATION_TIME, ZAPIER_OAUTH_SCOPES } from './zapier.config';
import { ICreateZapierIntegrationInput, IZapierAccessTokens, IZapierEndpoint, IZapierAuthState } from './zapier.types';
import { randomBytes } from 'node:crypto';

@Injectable()
export class ZapierService {
	private readonly logger = new Logger(ZapierService.name);
	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationSettingService: IntegrationSettingService,
		private readonly _integrationService: IntegrationService,
		private readonly config: ConfigService
	) {}

	/**
	 * Fetch data from an external integration API using HTTP GET request.
	 *
	 * @param {string} url - The URL to fetch data from.
	 * @param {string} token - Bearer token for authorization.
	 * @returns {Promise<any>} - A promise resolving to the fetched data.
	 */
	async fetchIntegration<T = any>(url: string, token: string): Promise<any> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		return firstValueFrom(
			this._httpService.get(url, { headers }).pipe(
				catchError((error: AxiosError<any>) => {
					if (!error.response) {
						throw new HttpException({ message: error.message, error }, HttpStatus.INTERNAL_SERVER_ERROR);
					}
					const response: AxiosResponse<any> = error.response;
					throw new HttpException({ message: error.message, error }, response.status);
				}),
				map((response: AxiosResponse<T>) => response.data)
			)
		);
	}

	/**
	 * Enhanced method to refresh the token with clearer error handling
	 *
	 * @param {ID} integrationId - The ID of the integration.
	 * @returns {Promise<any>} - The new tokens.
	 * @throws {NotFoundException} - When no settings are found for the given integration ID
 	 * @throws {BadRequestException} - When required settings (client_id, client_secret, refresh_token) are missing

	 */
	async refreshToken(integrationId: ID): Promise<IZapierAccessTokens> {
		try {
			// Fetch integration settings
			const settings = await this._integrationSettingService.find({
				where: {
					integration: { id: integrationId }
				}
			});

			if (!settings || settings.length === 0) {
				this.logger.warn(`No settings found for integration ID ${integrationId}`);
				throw new NotFoundException(`No settings found for integration ID ${integrationId}`);
			}

			// Extract required settings
			const client_id = settings.find((s) => s.settingsName === 'client_id')?.settingsValue;
			const client_secret = settings.find((s) => s.settingsName === 'client_secret')?.settingsValue;
			const refresh_token = settings.find((s) => s.settingsName === 'refresh_token')?.settingsValue;

			if (!client_id || !client_secret || !refresh_token) {
				this.logger.warn(`Missing required settings for integration ID ${integrationId}`);
				throw new BadRequestException('Missing required Zapier integration settings');
			}

			const result = await this.generateAndStoreNewTokens(integrationId);

			this.logger.log(
				`Successfully refreshed tokens for integration ID ${integrationId}`,
				{
					integrationId,
					client_id,
					tenantId: settings[0]?.tenantId,
					organizationId: settings[0]?.organizationId
				}
			);
			return result;
		} catch (error: any) {
			this.logger.error(`Failed to refresh token for integration ID ${integrationId}`, {
				error: error.message,
				integrationId
			});
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new HttpException('Unexpected error refreshing token', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Retrieve the Zapier access token for a given integration.
	 *
	 * @param {ID} integrationId - The ID of the integration.
	 * @returns {Promise<IIntegrationSetting>} - The integration setting containing the access token.
	 * @throws {NotFoundException} - If the access token is not found.
	 */
	async getZapierToken(integrationId: ID): Promise<IIntegrationSetting> {
		try {
			return await this._integrationSettingService.findOneByWhereOptions({
				integration: { id: integrationId },
				integrationId,
				settingsName: 'access_token'
			});
		} catch (error) {
			throw new NotFoundException(`Access token for integration ID ${integrationId} not found`);
		}
	}

	/**
	 * Generate the authorization URL for the Zapier OAuth flow.
	 */
	getAuthorizationUrl(options?: {
		state?: string;
		clientId?: string;
		organizationId?: string;
		integrationId?: string;
	}): string {
		try {
			const redirect_uri = this.config.get('zapier')?.redirectUri;
			if (!redirect_uri) {
				throw new Error('Zapier redirect URI is not configured');
			}

			// Validate redirect URI against allowed domains
			this.validateRedirectUri(redirect_uri);

			const organizationId = options?.organizationId;
			const integrationId = options?.integrationId;
			const tenantId = RequestContext.currentTenantId();

			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			// Use provided clientId or fallback to config
			const clientId = options?.clientId || this.config.get('zapier')?.clientId;
			if (!clientId) {
				throw new Error('Zapier client ID is not configured');
			}

			// Use provided state or generate a new one with all needed information
			const state =
				options?.state ??
				Buffer.from(
					JSON.stringify({
						tenantId,
						organizationId,
						integrationId,
						// Add cryptographically secure random component to prevent state prediction
						nonce: randomBytes(16).toString('hex'),
						timestamp: Date.now()
					})
				).toString('base64');

			if (!state || !state?.trim()) {
				throw new BadRequestException('State parameter is required');
			}

			// Build authorization URL according to Zapier documentation
			const params = new URLSearchParams({
				client_id: clientId,
				redirect_uri,
				response_type: 'code',
				state,
				scope: ZAPIER_OAUTH_SCOPES
			});

			return `${ZAPIER_API_URL}/v2/authorize?${params.toString()}`;
		} catch (error) {
			this.logger.error('Error generating Zapier authorization URL:', error);
			throw new BadRequestException('Invalid state parameter');
		}
	}

	/**
	 * Validate redirect URI against allowed domains
	 */
	private validateRedirectUri(redirectUri: string): void {
		try {
			const url = new URL(redirectUri);

			// Ensure HTTPS in production
			if (process.env['NODE_ENV'] === 'production' && url.protocol !== 'https:') {
				this.logger.warn(`Redirect URI rejected: non-HTTPS in production - ${url.hostname}`);
				throw new BadRequestException('Redirect URI must use HTTPS in production');
			}

			// Get allowed domains from configuration
			const allowedDomains = this.config.get('zapier')?.allowedDomains || [];

			this.logger.debug(
				`Validating redirect URI: ${url.hostname} against allowed domains: ${allowedDomains.join(', ')}`
			);

			// If allowed domains are configured, validate against them
			if (allowedDomains.length > 0) {
				const isAllowed = allowedDomains.some((domain) => {
					// Support wildcard subdomains (e.g., *.zapier.com)
					if (domain.startsWith('*.')) {
						const baseDomain = domain.substring(2);
						const matches = url.hostname === baseDomain || url.hostname.endsWith(`.${baseDomain}`);
						if (matches) {
							this.logger.debug(`Redirect URI allowed by wildcard domain: ${domain}`);
						}
						return matches;
					}
					const matches = url.hostname === domain;
					if (matches) {
						this.logger.debug(`Redirect URI allowed by exact domain: ${domain}`);
					}
					return matches;
				});

				if (!isAllowed) {
					this.logger.warn(`Redirect URI rejected: domain not in allowed list - ${url.hostname}`);
					throw new BadRequestException(`Redirect URI domain not allowed: ${url.hostname}`);
				}
			} else {
				this.logger.warn('No allowed domains configured - allowing all redirect URIs (security risk)');
			}

			this.logger.debug(`Redirect URI validation passed: ${url.hostname}`);
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(
				`Redirect URI validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			throw new BadRequestException('Invalid redirect URI format');
		}
	}

	/**
	 * Parse the state parameter from the OAuth callback
	 */
	parseAuthState(state: string): IZapierAuthState {
		try {
			const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());

			// Validate timestamp to prevent replay attacks (5 minutes max)
			if (decodedState.timestamp) {
				const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
				const age = Date.now() - decodedState.timestamp;
				if (age > maxAge) {
					throw new BadRequestException('State parameter has expired');
				}
			}

			// Validate required fields
			if (!decodedState.tenantId) {
				throw new BadRequestException('Invalid state parameter: missing tenant ID');
			}

			return {
				tenantId: decodedState.tenantId,
				organizationId: decodedState.organizationId,
				integrationId: decodedState.integrationId
			};
		} catch (error) {
			this.logger.error('Error parsing OAuth state:', error);
			throw new BadRequestException('Invalid state parameter');
		}
	}

	/**
	 * Store client credentials for later use in OAuth flow
	 */
	async storeIntegrationCredentials(input: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId() || undefined;
		const { client_id, client_secret, organizationId } = input;

		// Find or create the base integration
		const baseIntegration =
			(await this._integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.ZAPIER }
			})) || undefined;

		const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
			...entity,
			organizationId,
			tenantId
		}));

		// Map default entity settings
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

		// Store only the credentials at this point (not tokens yet)
		return await this._commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{
					name: IntegrationEnum.ZAPIER,
					integration: { provider: IntegrationEnum.ZAPIER },
					tenantId,
					organizationId
				},
				{
					name: IntegrationEnum.ZAPIER,
					integration: baseIntegration,
					organizationId,
					tenantId,
					entitySettings: entitySettings,
					settings: [
						{
							settingsName: 'client_id',
							settingsValue: client_id,
							tenantId,
							organizationId
						},
						{
							settingsName: 'client_secret',
							settingsValue: client_secret,
							tenantId,
							organizationId
						}
					]
				}
			)
		);
	}

	/**
	 * Complete the OAuth flow by exchanging the authorization code for tokens
	 */
	async completeOAuthFlow(code: string, stateData: IZapierAuthState): Promise<IIntegrationTenant> {
		try {
			// Find the integration with stored credentials
			let integrationTenant: IIntegrationTenant | null = null;

			if (stateData.integrationId) {
				const integration = await this._integrationService.findOneByIdString(stateData.integrationId);
				if (integration) {
					integrationTenant = {
						...integration,
						name: IntegrationEnum.ZAPIER
					};
				}
			} else {
				// Fallback to find by tenant and name
				const integration = await this._integrationService.findOneByOptions({
					where: {
						tenantId: stateData.tenantId,
						name: IntegrationEnum.ZAPIER
					} as any, // Cast to any to bypass type checking limitations
					relations: ['settings']
				});
				if (integration) {
					integrationTenant = {
						...integration,
						name: IntegrationEnum.ZAPIER
					};
				}
			}

			if (!integrationTenant) {
				throw new NotFoundException('Integration not found');
			}

			// Get settings to retrieve client_id and client_secret
			const settings = await this._integrationSettingService.find({
				where: {
					integration: { id: integrationTenant.id }
				}
			});

			const client_id = settings.find((s) => s.settingsName === 'client_id')?.settingsValue;
			const client_secret = settings.find((s) => s.settingsName === 'client_secret')?.settingsValue;

			if (!client_id || !client_secret) {
				throw new BadRequestException('Missing required Zapier integration settings');
			}

			const redirect_uri = this.config.get('zapier')?.redirectUri;
			if (!redirect_uri) {
				throw new Error('Zapier redirect URI is not configured');
			}

			// Exchange code for tokens
			const response = await firstValueFrom(
				this._httpService
					.post(
						`${ZAPIER_BASE_URL}/oauth/token/`,
						{
							client_id,
							client_secret,
							code,
							grant_type: 'authorization_code',
							redirect_uri
						},
						{
							headers: {
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error(
								'Error exchanging code for tokens:',
								error.response?.data || error.message
							);
							throw new BadRequestException('Failed to exchange code for tokens');
						}),
						map((response) => response.data)
					)
			);

			// Store the tokens
			const updatedSettings = [
				...settings,
				{
					settingsName: 'access_token',
					settingsValue: response.access_token,
					tenantId: stateData.tenantId,
					organizationId: stateData.organizationId,
					integrationId: integrationTenant.id
				},
				{
					settingsName: 'refresh_token',
					settingsValue: response.refresh_token,
					tenantId: stateData.tenantId,
					organizationId: stateData.organizationId,
					integrationId: integrationTenant.id
				}
			].filter((setting, index, self) => {
				// Keep only unique settings by name (avoiding duplicates)
				return index === self.findIndex((s) => s.settingsName === setting.settingsName);
			}) as DeepPartial<IIntegrationEntitySetting>;

			await this._integrationSettingService.save(updatedSettings);

			return integrationTenant;
		} catch (error) {
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error('Error completing OAuth flow:', error);
			throw new HttpException('Failed to complete OAuth flow', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Fetches and returns a list of triggers from Zapier.
	 *
	 * @param {string} token - The access token for authentication with the Zapier API.
	 * @returns {Promise<IZapierEndpoint[]>} - A promise that resolves to an array of Zapier triggers.
	 * @throws {Error} - Throws an error if the fetch operation fails.
	 */
	async fetchTriggers(token: string): Promise<IZapierEndpoint[]> {
		try {
			const response = await this.fetchIntegration<{ triggers: IZapierEndpoint[] }>('triggers', token);
			return response.triggers;
		} catch (error) {
			console.error('Failed to fetch Zapier triggers:', error);
			throw new Error('Unable to fetch triggers from Zapier');
		}
	}

	/**
	 * Fetches and returns a list of actions from Zapier.
	 *
	 * @param {string} token - The access token for authentication with the Zapier API.
	 * @returns {Promise<IZapierEndpoint[]>} - A promise that resolves to an array of Zapier actions.
	 * @throws {Error} - Throws an error if the fetch operation fails.
	 */
	async fetchActions(token: string): Promise<IZapierEndpoint[]> {
		try {
			const response = await this.fetchIntegration<{ actions: IZapierEndpoint[] }>('actions', token);
			return response.actions;
		} catch (error) {
			console.error('Failed to fetch Zapier actions:', error);
			throw new Error('Unable to fetch actions from Zapier');
		}
	}

	/**
	 * Retrieves the Zapier integration tenant associated with the given access token.
	 * @param token - The OAuth access token to verify.
	 * @returns The matching IIntegrationTenant.
	 * @throws NotFoundException if the token is invalid or no Zapier integration is found.
	 */
	async findIntegrationByToken(token: string): Promise<IIntegrationTenant> {
		// 1) Lookup the access_token setting
		const setting = await this._integrationSettingService.findOneByWhereOptions({
			settingsName: 'access_token',
			settingsValue: token
		});

		// 2) Ensure we have an integrationId
		if (!setting?.integrationId) {
			throw new NotFoundException('Invalid access token');
		}

		// 3) Load the integration tenant, scoped to Zapier, including its settings
		const integrationTenant = await this._integrationService.findOneByIdString(setting.integrationId, {
			where: { name: IntegrationEnum.ZAPIER },
			relations: ['settings']
		});

		// 4) Handle missing tenant
		if (!integrationTenant) {
			throw new NotFoundException('Zapier integration not found for the provided token');
		}

		// 5) Return with correct enum typing
		return {
			...integrationTenant,
			name: IntegrationEnum.ZAPIER
		};
	}

	/**
	 * Find integration by client_id
	 * @param clientId - The OAuth client ID
	 * @returns The matching IIntegrationTenant
	 * @throws NotFoundException if no integration is found
	 */
	async findIntegrationByClientId(clientId: string): Promise<IIntegrationTenant> {
		// Find the client_id setting
		const setting = await this._integrationSettingService.findOneByWhereOptions({
			settingsName: 'client_id',
			settingsValue: clientId
		});

		if (!setting?.integrationId) {
			throw new NotFoundException('Invalid client ID');
		}

		// Load the integration tenant
		const integrationTenant = await this._integrationService.findOneByIdString(setting.integrationId, {
			where: { name: IntegrationEnum.ZAPIER },
			relations: ['settings']
		});

		if (!integrationTenant) {
			throw new NotFoundException('Zapier integration not found for the provided client ID');
		}

		return {
			...integrationTenant,
			name: IntegrationEnum.ZAPIER
		};
	}

	/**
	 * Validate client secret for OAuth flow
	 * @param integrationId - The integration ID
	 * @param clientSecret - The client secret to validate
	 * @throws BadRequestException if client secret is invalid
	 */
	async validateClientSecret(integrationId: ID, clientSecret: string): Promise<void> {
		const settings = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId }
			}
		});

		const storedClientSecret = settings.find((s) => s.settingsName === 'client_secret')?.settingsValue;

		if (!storedClientSecret || storedClientSecret !== clientSecret) {
			throw new BadRequestException('Invalid client credentials');
		}
	}

	/**
	 * Store access and refresh tokens for an integration
	 * @param integrationId - The integration ID
	 * @param accessToken - The access token to store
	 * @param refreshToken - The refresh token to store
	 */
	async storeTokens(integrationId: ID, accessToken: string, refreshToken: string): Promise<void> {
		// Get existing settings
		const existingSettings = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId }
			}
		});

		// Find tenant and organization info from existing settings
		const tenantId = existingSettings[0]?.tenantId;
		const organizationId = existingSettings[0]?.organizationId;

		// Prepare token settings
		const tokenSettings = [
			{
				settingsName: 'access_token',
				settingsValue: accessToken,
				tenantId,
				organizationId,
				integrationId
			},
			{
				settingsName: 'refresh_token',
				settingsValue: refreshToken,
				tenantId,
				organizationId,
				integrationId
			}
		];

		// Remove existing token settings and add new ones
		const filteredExistingSettings = existingSettings.filter(
			(setting) => !['access_token', 'refresh_token'].includes(setting.settingsName)
		);

		const allSettings = [...filteredExistingSettings, ...tokenSettings] as DeepPartial<IIntegrationEntitySetting>;

		await this._integrationSettingService.save(allSettings);
	}

	private async generateAndStoreNewTokens(integration: ID): Promise<IZapierAccessTokens> {
		const access_token = randomBytes(32).toString('hex');
		const new_refresh_token = randomBytes(32).toString('hex');

		await this.storeTokens(integration, access_token, new_refresh_token);

		return {
			access_token,
			refresh_token: new_refresh_token,
			token_type: 'Bearer',
			expires_in: ZAPIER_TOKEN_EXPIRATION_TIME
		};
	}

	/**
	 * Refresh token using refresh token (alternative to refreshToken method)
	 * @param integrationId - The integration ID
	 * @param refreshToken - The refresh token to verify
	 * @returns New access and refresh tokens
	 * @throws NotFoundException if integration or refresh token is invalid
	 */
	async refreshTokenByRefreshToken(integrationId: ID, refreshToken: string): Promise<IZapierAccessTokens> {
		try {
			// Fetch integration settings
			const settings = await this._integrationSettingService.find({
				where: {
					integration: { id: integrationId }
				}
			});

			if (!settings || settings.length === 0) {
				throw new NotFoundException(`No settings found for integration ID ${integrationId}`);
			}

			// Verify the refresh token matches
			const storedRefreshToken = settings.find((s) => s.settingsName === 'refresh_token')?.settingsValue;
			if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
				throw new BadRequestException('Invalid refresh token');
			}

			// Extract required settings
			const client_id = settings.find((s) => s.settingsName === 'client_id')?.settingsValue;
			const client_secret = settings.find((s) => s.settingsName === 'client_secret')?.settingsValue;

			if (!client_id || !client_secret) {
				throw new BadRequestException('Missing required Zapier integration settings');
			}

			return this.generateAndStoreNewTokens(integrationId);
		} catch (error: any) {
			this.logger.error(`Failed to refresh token for integration ID ${integrationId}`, {
				error: error.message,
				integrationId
			});
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new HttpException('Unexpected error refreshing token', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
