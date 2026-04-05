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
 	 * @throws {BadRequestException} - When the refresh token is missing
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

			// Extract the Gauzy-issued OAuth refresh token
			const refresh_token = settings.find((s) => s.settingsName === 'oauth_refresh_token')?.settingsValue;

			if (!refresh_token) {
				this.logger.warn(`Missing refresh token for integration ID ${integrationId}`);
				throw new BadRequestException('Missing refresh token for integration');
			}

			const result = await this.generateAndStoreNewTokens(integrationId);

			this.logger.log(`Successfully refreshed tokens for integration ID ${integrationId}`, {
				integrationId,
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
				settingsName: 'zapier_access_token'
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

			return `${ZAPIER_BASE_URL}/oauth/authorize/?${params.toString()}`;
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
	 * Searches across all tenants by state value so it works from @Public() endpoints.
	 *
	 * @param state The state parameter to validate
	 * @returns The parsed state data if valid (includes tenantId and integrationId)
	 * @throws {BadRequestException} If state is invalid or expired
	 */
	async parseAuthState(
		state: string
	): Promise<{ state: string; tenantId?: string; integrationId?: string; expiresAt?: string }> {
		try {
			// Basic validation - state should be a non-empty string
			if (!state || typeof state !== 'string' || state.trim().length === 0) {
				throw new BadRequestException('Invalid state parameter');
			}

			// Escape LIKE metacharacters (including backslash) to prevent unintended pattern matching
			const escapedState = state.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');

			// Search for the state across all tenants by value
			const stateSettings = await this._integrationSettingService.find({
				where: {
					settingsName: 'state',
					settingsValue: Like(`%"state":"${escapedState}"%`)
				}
			});

			// Find the matching state setting
			const stateSetting = stateSettings.find((s) => {
				try {
					const parsed = JSON.parse(s.settingsValue ?? '{}');
					return parsed.state === state;
				} catch {
					return false;
				}
			});

			if (!stateSetting) {
				throw new BadRequestException('State not found');
			}

			try {
				const parsedState = JSON.parse(stateSetting.settingsValue);

				// Check expiration
				if (parsedState.expiresAt && new Date(parsedState.expiresAt) < new Date()) {
					throw new BadRequestException('State has expired');
				}

				return parsedState;
			} catch (error) {
				if (error instanceof BadRequestException) {
					throw error;
				}
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
		let expirationTime = new Date();
		expirationTime.setMinutes(expirationTime.getMinutes() + 10); // State expires in 10 minutes

		await this._integrationSettingService.create({
			settingsName: 'state',
			tenantId,
			organizationId,
			integrationId,
			settingsValue: JSON.stringify({
				state,
				tenantId,
				integrationId,
				expiresAt: expirationTime.toISOString()
			})
		});
	}

	/**
	 * Store integration credentials using server-side config.
	 * Client credentials (client_id, client_secret) are read from environment variables
	 * and are never exposed to or stored in tenant records.
	 */
	async storeIntegrationCredentials(input: { organizationId: string; state: string }): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}
		const { state, organizationId } = input;

		if (!state) {
			throw new BadRequestException('State parameter is required');
		}

		// Validate that server-side OAuth credentials are configured (do NOT persist them to tenant)
		const zapierConfig = this.config.get('zapier');
		if (!zapierConfig?.clientId || !zapierConfig?.clientSecret) {
			throw new BadRequestException('Zapier OAuth credentials are not configured on the server. Please set GAUZY_ZAPIER_CLIENT_ID and GAUZY_ZAPIER_CLIENT_SECRET environment variables.');
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

		// Create the integration (without storing global OAuth credentials in tenant records)
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
	 * Complete the OAuth flow by exchanging the authorization code for tokens.
	 * Accepts tenantId as a parameter so it works from @Public() callback endpoints.
	 *
	 * @param code The authorization code from Zapier
	 * @param state The state parameter for CSRF validation
	 * @param tenantId The tenant ID (from parsed state or RequestContext)
	 */
	async completeOAuthFlow(code: string, state: string, tenantId?: string): Promise<IIntegrationTenant> {
		try {
			// Use provided tenantId or fall back to request context
			const resolvedTenantId = tenantId || RequestContext.currentTenantId();
			if (!resolvedTenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			// Validate and atomically delete the state
			await this.validateAndDeleteState(state, resolvedTenantId);

			// Find the integration by tenant and Zapier provider
			const integration = await this._integrationService.findOneByOptions({
				where: {
					tenantId: resolvedTenantId,
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

			// Read client credentials from server-side config (env vars) — never from tenant data
			const zapierConfig = this.config.get('zapier');
			const client_id = zapierConfig?.clientId;
			const client_secret = zapierConfig?.clientSecret;

			if (!client_id || !client_secret) {
				throw new BadRequestException('Zapier OAuth credentials are not configured on the server');
			}

			// Fetch settings for other purposes (not client credentials)
			const settings = await this._integrationSettingService.find({
				where: {
					integration: { id: integrationTenant.id }
				}
			});

			const redirect_uri = this.config.get('zapier')?.redirectUri;
			if (!redirect_uri) {
				throw new Error('Zapier redirect URI is not configured');
			}

			// Exchange code for tokens using application/x-www-form-urlencoded (OAuth2 standard)
			const tokenParams = new URLSearchParams({
				client_id,
				client_secret,
				code,
				grant_type: 'authorization_code',
				redirect_uri
			});

			const response = await firstValueFrom(
				this._httpService
					.post(`${ZAPIER_BASE_URL}/oauth/token/`, tokenParams.toString(), {
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							Accept: 'application/json'
						}
					})
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

			// Store the tokens — delete ALL old token settings (Zapier + Gauzy OAuth) first, then save new ones
			const existingSetting = settings[0];
			const allTokenSettingNames = [
				'zapier_access_token',
				'zapier_refresh_token',
				'oauth_access_token',
				'oauth_refresh_token'
			];
			const staleTokens = settings.filter((s) => allTokenSettingNames.includes(s.settingsName));
			await Promise.all(
				staleTokens
					.map((s) => s.id)
					.filter((id): id is string => id != null)
					.map((id) => this._integrationSettingService.delete(id))
			);

			const filteredSettings = settings.filter((s) => !allTokenSettingNames.includes(s.settingsName));

			const updatedSettings = [
				...filteredSettings,
				{
					settingsName: 'zapier_access_token',
					settingsValue: response.access_token,
					tenantId: existingSetting?.tenantId || resolvedTenantId,
					organizationId: existingSetting?.organizationId,
					integrationId: integrationTenant.id
				},
				{
					settingsName: 'zapier_refresh_token',
					settingsValue: response.refresh_token,
					tenantId: existingSetting?.tenantId || resolvedTenantId,
					organizationId: existingSetting?.organizationId,
					integrationId: integrationTenant.id
				}
			] as any;

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
			const response = await this.fetchIntegration<{ triggers: IZapierEndpoint[] }>(
				`${ZAPIER_API_URL}/v2/triggers`,
				token
			);
			return response.triggers;
		} catch (error) {
			this.logger.error('Failed to fetch Zapier triggers:', error);
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
			const response = await this.fetchIntegration<{ actions: IZapierEndpoint[] }>(
				`${ZAPIER_API_URL}/v2/actions`,
				token
			);
			return response.actions;
		} catch (error) {
			this.logger.error('Failed to fetch Zapier actions:', error);
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
		// 1) Lookup the Gauzy-issued OAuth access token (separate from Zapier API tokens)
		const setting = await this._integrationSettingService.findOneByWhereOptions({
			settingsName: 'oauth_access_token',
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
	 * Resolve the tenant integration by searching for a Gauzy-issued authorization code.
	 * Auth codes are stored per-integration with tenantId, so this reliably maps
	 * the code to the correct tenant regardless of shared global client_id.
	 *
	 * @param code - The Gauzy-issued authorization code
	 * @returns The matching IIntegrationTenant
	 * @throws NotFoundException if the code is invalid or expired
	 */
	async findIntegrationByAuthCode(code: string): Promise<IIntegrationTenant> {
		// Search for auth_code settings by value across all tenants
		const codeSettings = await this._integrationSettingService.find({
			where: {
				settingsName: 'auth_code'
			}
		});

		const codeSetting = codeSettings.find((s) => {
			try {
				const parsed = JSON.parse(s.settingsValue ?? '{}');
				return parsed.code === code;
			} catch {
				return false;
			}
		});

		if (!codeSetting?.integrationId) {
			throw new NotFoundException('Invalid authorization code');
		}

		// Verify the code hasn't expired
		try {
			const parsed = JSON.parse(codeSetting.settingsValue ?? '{}');
			if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
				throw new BadRequestException('Authorization code has expired');
			}
		} catch (e) {
			if (e instanceof BadRequestException) throw e;
		}

		const integrationTenant = await this._integrationService.findOneByIdString(codeSetting.integrationId, {
			where: { name: IntegrationEnum.ZAPIER },
			relations: ['settings']
		});

		if (!integrationTenant) {
			throw new NotFoundException('Zapier integration not found for the provided authorization code');
		}

		return {
			...integrationTenant,
			name: IntegrationEnum.ZAPIER
		};
	}

	/**
	 * Resolve the tenant integration by searching for a Gauzy-issued refresh token.
	 * Refresh tokens are stored per-integration with tenantId, so this reliably maps
	 * the token to the correct tenant regardless of shared global client_id.
	 *
	 * @param refreshToken - The Gauzy-issued refresh token
	 * @returns The matching IIntegrationTenant
	 * @throws NotFoundException if the token is invalid
	 */
	async findIntegrationByGauzyRefreshToken(refreshToken: string): Promise<IIntegrationTenant> {
		// Search for oauth_refresh_token settings by value across all tenants
		const tokenSettings = await this._integrationSettingService.find({
			where: {
				settingsName: 'oauth_refresh_token'
			}
		});

		const tokenSetting = tokenSettings.find((s) => s.settingsValue === refreshToken);

		if (!tokenSetting?.integrationId) {
			throw new NotFoundException('Invalid refresh token');
		}

		const integrationTenant = await this._integrationService.findOneByIdString(tokenSetting.integrationId, {
			where: { name: IntegrationEnum.ZAPIER },
			relations: ['settings']
		});

		if (!integrationTenant) {
			throw new NotFoundException('Zapier integration not found for the provided refresh token');
		}

		return {
			...integrationTenant,
			name: IntegrationEnum.ZAPIER
		};
	}

	/**
	 * Validate that the provided client_id and client_secret match the server-side
	 * Zapier OAuth configuration. This replaces the old approach of looking up
	 * credentials in tenant integration records.
	 *
	 * @param clientId - The client_id from the request
	 * @param clientSecret - The client_secret from the request
	 * @throws BadRequestException if credentials don't match server config
	 */
	validateServerClientCredentials(clientId: string, clientSecret: string): void {
		const zapierConfig = this.config.get('zapier');
		if (
			!zapierConfig?.clientId ||
			!zapierConfig?.clientSecret ||
			zapierConfig.clientId !== clientId ||
			zapierConfig.clientSecret !== clientSecret
		) {
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

		// Prepare Gauzy-issued OAuth token settings (distinct from Zapier API tokens)
		const tokenSettings = [
			{
				settingsName: 'oauth_access_token',
				settingsValue: accessToken,
				tenantId,
				organizationId,
				integrationId
			},
			{
				settingsName: 'oauth_refresh_token',
				settingsValue: refreshToken,
				tenantId,
				organizationId,
				integrationId
			}
		];

		// Delete ALL existing token settings (both Gauzy OAuth and Zapier API tokens) before saving new ones
		const allTokenSettingNames = [
			'oauth_access_token',
			'oauth_refresh_token',
			'zapier_access_token',
			'zapier_refresh_token'
		];
		const staleTokens = existingSettings.filter((setting) => allTokenSettingNames.includes(setting.settingsName));
		await Promise.all(
			staleTokens
				.map((s) => s.id)
				.filter((id): id is string => id != null)
				.map((id) => this._integrationSettingService.delete(id))
		);

		const filteredExistingSettings = existingSettings.filter(
			(setting) => !allTokenSettingNames.includes(setting.settingsName)
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

			// Verify the Gauzy-issued OAuth refresh token matches
			const storedRefreshToken = settings.find((s) => s.settingsName === 'oauth_refresh_token')?.settingsValue;
			if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
				throw new BadRequestException('Invalid refresh token');
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
	 * Store a short-lived authorization code for the OAuth flow.
	 * The code is single-use and expires in 10 minutes.
	 *
	 * @param integrationId The integration ID
	 * @param code The authorization code
	 * @param redirectUri The redirect URI used in the authorization request
	 */
	async storeAuthCode(integrationId: ID, code: string, redirectUri: string): Promise<void> {
		const existingSettings = await this._integrationSettingService.find({
			where: { integration: { id: integrationId } }
		});

		const tenantId = existingSettings[0]?.tenantId;
		const organizationId = existingSettings[0]?.organizationId;

		// Invalidate any existing auth_code records for this integration
		const existingAuthCodes = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId },
				settingsName: 'auth_code'
			}
		});
		for (const existing of existingAuthCodes) {
			if (existing.id) {
				await this._integrationSettingService.delete(existing.id);
			}
		}

		let expirationTime = new Date();
		expirationTime.setMinutes(expirationTime.getMinutes() + 10);

		await this._integrationSettingService.create({
			settingsName: 'auth_code',
			tenantId,
			organizationId,
			integrationId,
			settingsValue: JSON.stringify({
				code,
				redirectUri,
				expiresAt: expirationTime.toISOString()
			})
		});
	}

	/**
	 * Validate and consume an authorization code (single-use, atomic delete).
	 * Uses a conditional delete (id + original settingsValue) to prevent
	 * concurrent requests from both validating and minting tokens.
	 *
	 * @param integrationId The integration ID
	 * @param code The authorization code to validate
	 * @param redirectUri The redirect URI to verify against the stored one
	 * @throws BadRequestException if code is invalid, expired, already consumed, or redirect_uri mismatch
	 */
	async validateAndConsumeAuthCode(integrationId: ID, code: string, redirectUri: string): Promise<void> {
		const codeSettings = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId },
				settingsName: 'auth_code'
			}
		});

		// Find matching auth code
		const codeSetting = codeSettings.find((s) => {
			try {
				const parsed = JSON.parse(s.settingsValue ?? '{}');
				return parsed.code === code;
			} catch {
				return false;
			}
		});

		if (!codeSetting || !codeSetting.id) {
			throw new BadRequestException('Invalid authorization code');
		}

		let parsedCode: any;
		try {
			parsedCode = JSON.parse(codeSetting.settingsValue ?? '{}');
		} catch {
			// Corrupted data — cleanup by ID only and fail
			await this._integrationSettingService.typeOrmIntegrationSettingRepository.delete(codeSetting.id);
			throw new BadRequestException('Corrupted authorization code data');
		}

		// Check expiration
		if (parsedCode.expiresAt && new Date(parsedCode.expiresAt) < new Date()) {
			// Use repository.delete() with FindOptionsWhere for atomic single-use guarantee
			const result = await this._integrationSettingService.typeOrmIntegrationSettingRepository.delete({
				id: codeSetting.id,
				settingsValue: codeSetting.settingsValue
			});
			if (result.affected !== 1) {
				throw new BadRequestException('Invalid authorization code');
			}
			throw new BadRequestException('Authorization code has expired');
		}

		// Verify redirect_uri matches
		if (parsedCode.redirectUri && parsedCode.redirectUri !== redirectUri) {
			throw new BadRequestException('Redirect URI mismatch');
		}

		// Atomic single-use delete: only succeed if no other request already consumed this code.
		// We match on both id AND the exact settingsValue to detect concurrent consumption.
		// Use repository.delete() with FindOptionsWhere to ensure both predicates are applied.
		const result = await this._integrationSettingService.typeOrmIntegrationSettingRepository.delete({
			id: codeSetting.id,
			settingsValue: codeSetting.settingsValue
		});

		if (result.affected !== 1) {
			// Another concurrent request already consumed this code.
			throw new BadRequestException('Invalid authorization code');
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
			const accessTokenSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'zapier_access_token'
			);
			const refreshTokenSetting = integrationTenant.settings?.find(
				(setting: IIntegrationSetting) => setting.settingsName === 'zapier_refresh_token'
			);

			// Client credentials are server-side config, not tenant-specific
			const zapierConfig = this.config.get('zapier');
			const hasClientCredentials = !!(zapierConfig?.clientId && zapierConfig?.clientSecret);

			// Map to sanitized DTO
			return {
				isEnabled: enabledSetting ? enabledSetting.settingsValue === 'true' : false,
				hasClientCredentials,
				hasAccessToken: !!accessTokenSetting?.settingsValue,
				hasRefreshToken: !!refreshTokenSetting?.settingsValue
			};
		} catch (error) {
			this.logger.error('Error retrieving Zapier integration settings:', error);
			throw error;
		}
	}
}
