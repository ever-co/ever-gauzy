import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError, AxiosResponse } from 'axios';
import { DeepPartial, Like } from 'typeorm';
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
	RequestContext,
	IntegrationTenantService
} from '@gauzy/core';
import { ZAPIER_API_URL, ZAPIER_BASE_URL, ZAPIER_TOKEN_EXPIRATION_TIME, ZAPIER_OAUTH_SCOPES } from './zapier.config';
import {
	ICreateZapierIntegrationInput,
	IIntegrationFilter,
	IZapierAccessTokens,
	IZapierEndpoint,
	IZapierIntegrationSettings
} from './zapier.types';
import { randomBytes } from 'node:crypto';

@Injectable()
export class ZapierService {
	private readonly logger = new Logger(ZapierService.name);
	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationSettingService: IntegrationSettingService,
		private readonly _integrationService: IntegrationService,
		private readonly _integrationTenantService: IntegrationTenantService,
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

			this.logger.log(`Successfully refreshed tokens for integration ID ${integrationId}`, {
				integrationId,
				client_id,
				tenantId: settings[0]?.tenantId,
				organizationId: settings[0]?.organizationId
			});
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
	 * @param options.clientId - The OAuth client ID
	 * @param options.state - The state parameter for CSRF protection (required)
	 * @returns The authorization URL
	 * @throws BadRequestException if state is missing or invalid
	 */
	getAuthorizationUrl(options?: { clientId?: string; state?: string }): string {
		try {
			const redirect_uri = this.config.get('zapier')?.redirectUri;
			if (!redirect_uri) {
				throw new Error('Zapier redirect URI is not configured');
			}

			// Validate redirect URI against allowed domains
			this.validateRedirectUri(redirect_uri);

			// Use provided clientId or fallback to config
			const clientId = options?.clientId || this.config.get('zapier')?.clientId;
			if (!clientId) {
				throw new Error('Zapier client ID is not configured');
			}

			// Use provided state or generate a new one using simple random generation
			const state = options?.state || Buffer.from(randomBytes(32)).toString('base64url');

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
			throw new BadRequestException('Failed to generate authorization URL');
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
	 * Validates and atomically deletes the state parameter
	 * @param state The state parameter to validate
	 * @param tenantId The tenant ID
	 * @returns The parsed state if valid, null otherwise
	 */
	async validateAndDeleteState(state: string, tenantId: string): Promise<{ state: string; expiresAt?: string }> {
		try {
			// Basic validation - state should be a non-empty string
			if (!state || typeof state !== 'string' || state.trim().length === 0) {
				throw new BadRequestException('Invalid state parameter');
			}

			// Find the integration by tenant and Zapier provider
			const integration = await this._integrationService.findOneByOptions({
				where: {
					tenantId,
					name: IntegrationEnum.ZAPIER
				} as IIntegrationFilter
			});

			if (!integration) {
				throw new NotFoundException('Zapier integration not found for current tenant');
			}

			// Find the state setting
			const stateSettings = await this._integrationSettingService.find({
				where: {
					integration: { id: integration.id },
					settingsName: 'state',
					tenantId,
					settingsValue: Like(`%"state":"${state}"%`)
				}
			});

			// Search through all state settings to find the matching state
			const stateSetting = stateSettings.find((s) => {
				try {
					const parsed = JSON.parse(s.settingsValue ?? '{}');
					return parsed.state === state;
				} catch {
					return false;
				}
			});

			if (!stateSetting || !stateSetting.id) {
				throw new BadRequestException('State not found');
			}

			try {
				const parsedState = JSON.parse(stateSetting.settingsValue);

				// Validate state match (redundant check but kept for clarity)
				if (parsedState.state !== state) {
					throw new BadRequestException('Invalid state parameter');
				}

				// Check expiration
				if (parsedState.expiresAt && new Date(parsedState.expiresAt) < new Date()) {
					throw new BadRequestException('State has expired');
				}

				// Delete the state
				await this._integrationSettingService.delete(stateSetting.id);

				return parsedState;
			} catch (error) {
				if (error instanceof BadRequestException) {
					throw error;
				}
				throw new BadRequestException('Invalid state format');
			}
		} catch (error) {
			this.logger.error('Error validating and deleting state:', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException('Failed to validate state parameter');
		}
	}

	/**
	 * Validates the state parameter without deleting it.
	 * This is used for initial validation before the OAuth flow.
	 *
	 * @param state The state parameter to validate
	 * @returns The parsed state data if valid
	 * @throws {BadRequestException} If state is invalid or expired
	 */
	async parseAuthState(state: string): Promise<{ state: string; expiresAt?: string }> {
		try {
			// Basic validation - state should be a non-empty string
			if (!state || typeof state !== 'string' || state.trim().length === 0) {
				throw new BadRequestException('Invalid state parameter');
			}

			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			// Find the integration by current tenant and Zapier provider
			const integration = await this._integrationService.findOneByOptions({
				where: {
					tenantId,
					name: IntegrationEnum.ZAPIER
				} as IIntegrationFilter,
				relations: ['settings']
			});

			if (!integration) {
				throw new NotFoundException('Zapier integration not found for current tenant');
			}

			// Get settings to retrieve state
			const settings = await this._integrationSettingService.find({
				where: {
					integration: { id: integration.id }
				}
			});

			const storedState = settings.find((s) => s.settingsName === 'state')?.settingsValue;

			if (!storedState) {
				throw new BadRequestException('State not found');
			}

			try {
				const parsedState = JSON.parse(storedState);
				if (parsedState.state !== state) {
					throw new BadRequestException('Invalid state parameter');
				}
				// Check expiration
				if (parsedState.expiresAt && new Date(parsedState.expiresAt) < new Date()) {
					throw new BadRequestException('State has expired');
				}

				return parsedState;
			} catch (error) {
				throw new BadRequestException('Invalid state format');
			}
		} catch (error) {
			this.logger.error('Error validating state parameter:', error);
			if (error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException('Failed to validate state parameter');
		}
	}

	/**
	 * Stores the state parameter with an expiration timestamp
	 * @param state The state parameter to store
	 * @param tenantId The tenant ID
	 * @param integrationId The integration ID
	 * @param organizationId Optional organization ID
	 */
	private async storeStateWithExpiration(
		state: string,
		tenantId: string,
		integrationId: string,
		organizationId?: string
	): Promise<void> {
		const expirationTime = new Date();
		expirationTime.setMinutes(expirationTime.getMinutes() + 10); // State expires in 10 minutes

		await this._integrationSettingService.create({
			settingsName: 'state',
			tenantId,
			organizationId,
			integrationId,
			settingsValue: JSON.stringify({
				state,
				expiresAt: expirationTime.toISOString()
			})
		});
	}

	/**
	 * Store client credentials for later use in OAuth flow
	 */
	async storeIntegrationCredentials(input: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}
		const { client_id, client_secret, state, organizationId } = input;

		if (!state) {
			throw new BadRequestException('State parameter is required');
		}

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

		// Create the integration first
		const integration = await this._commandBus.execute(
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
							settingsName: 'is_enabled',
							settingsValue: 'true',
							tenantId,
							organizationId
						},
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

		// Now store state with the integration ID
		await this.storeStateWithExpiration(state, tenantId, integration.id, organizationId);

		return integration;
	}

	/**
	 * Complete the OAuth flow by exchanging the authorization code for tokens
	 */
	async completeOAuthFlow(code: string, state: string): Promise<IIntegrationTenant> {
		try {
			// Get current tenant ID from request context
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			// Validate and atomically delete the state
			await this.validateAndDeleteState(state, tenantId);

			// Find the integration by current tenant and Zapier provider
			const integration = await this._integrationService.findOneByOptions({
				where: {
					tenantId,
					name: IntegrationEnum.ZAPIER
				} as IIntegrationFilter,
				relations: ['settings']
			});

			if (!integration) {
				throw new NotFoundException('Zapier integration not found for current tenant');
			}

			const integrationTenant: IIntegrationTenant = {
				...integration,
				name: IntegrationEnum.ZAPIER
			};

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

			// Store the tokens using the existing settings' tenant and organization info
			const existingSetting = settings[0];
			const updatedSettings = [
				...settings,
				{
					settingsName: 'access_token',
					settingsValue: response.access_token,
					tenantId: existingSetting?.tenantId || tenantId,
					organizationId: existingSetting?.organizationId,
					integrationId: integrationTenant.id
				},
				{
					settingsName: 'refresh_token',
					settingsValue: response.refresh_token,
					tenantId: existingSetting?.tenantId || tenantId,
					organizationId: existingSetting?.organizationId,
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

	/**
	 * Generates and stores new access and refresh tokens for an integration
	 * @param integrationId The integration ID
	 * @returns The generated tokens
	 */
	async generateAndStoreNewTokens(integrationId: ID): Promise<IZapierAccessTokens> {
		const access_token = randomBytes(32).toString('hex');
		const new_refresh_token = randomBytes(32).toString('hex');

		await this.storeTokens(integrationId, access_token, new_refresh_token);

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

	/**
	 * Retrieves the Zapier integration settings for the current tenant.
	 *
	 * @param {string} [organizationId] - Optional organization ID to filter settings
	 * @returns {Promise<IZapierIntegrationSettings>} A promise that resolves with the tenant's Zapier integration settings
	 */
	async getIntegrationSettings(organizationId?: string): Promise<IZapierIntegrationSettings> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Build the where clause with tenant and optional organization filter
			const whereClause: IIntegrationFilter = {
				name: IntegrationEnum.ZAPIER,
				tenantId
			};

			// If organizationId is provided, filter by organization level
			if (organizationId) {
				whereClause.organizationId = organizationId;
			}

			// Find the integration for the current tenant and organization
			const integrationTenant = await this._integrationTenantService.findOneByOptions({
				where: whereClause,
				relations: ['settings']
			});

			if (!integrationTenant) {
				return {
					isEnabled: false,
					hasClientCredentials: false,
					hasAccessToken: false,
					hasRefreshToken: false
				};
			}

			// Extract settings from integration settings
			const enabledSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'is_enabled'
			);
			const clientIdSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'client_id'
			);
			const clientSecretSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'client_secret'
			);
			const accessTokenSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'access_token'
			);
			const refreshTokenSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'refresh_token'
			);

			// Map to sanitized DTO
			return {
				isEnabled: enabledSetting ? enabledSetting.settingsValue === 'true' : false,
				hasClientCredentials: !!(clientIdSetting?.settingsValue && clientSecretSetting?.settingsValue),
				hasAccessToken: !!accessTokenSetting?.settingsValue,
				hasRefreshToken: !!refreshTokenSetting?.settingsValue
			};
		} catch (error) {
			this.logger.error('Error retrieving Zapier integration settings:', error);
			throw error;
		}
	}
}
