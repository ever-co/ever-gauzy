import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationSettingService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { In } from 'typeorm';
import { IntegrationEnum } from '@gauzy/contracts';
import { MakeComOAuthService } from './make-com-oauth.service';
import { IMakeComIntegrationSettings, MakeSettingName } from './interfaces/make-com.model';

@Injectable()
export class MakeComService {
	private readonly logger = new Logger(MakeComService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationTenantService: IntegrationTenantService,
		@Inject(forwardRef(() => MakeComOAuthService))
		private readonly makeComOAuthService: MakeComOAuthService
	) {}

	/**
	 * Retrieves Make.com integration settings for the current tenant.
	 *
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the Make.com integration settings.
	 */
	async getIntegrationSettings(): Promise<IMakeComIntegrationSettings> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Find the integration for the current tenant
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					name: IntegrationEnum.MakeCom,
					tenantId
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				return {
					isEnabled: false,
					webhookUrl: null
				};
			}

			// Extract webhook settings from integration settings
			const enabledSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
			);
			const webhookUrlSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.WEBHOOK_URL
			);

			return {
				isEnabled: enabledSetting ? enabledSetting.settingsValue === 'true' : false,
				webhookUrl: webhookUrlSetting ? webhookUrlSetting.settingsValue : null
			};
		} catch (error) {
			this.logger.error('Error retrieving Make.com integration settings:', error);
			throw error;
		}
	}

	/**
	 * Updates Make.com integration settings for the current tenant.
	 *
	 * @param {Object} input - The settings to update.
	 * @param {boolean} input.isEnabled - Whether the integration is enabled.
	 * @param {string} input.webhookUrl - The webhook URL for Make.com.
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the updated settings.
	 */
	async updateIntegrationSettings(input: {
		isEnabled?: boolean;
		webhookUrl?: string;
	}): Promise<IMakeComIntegrationSettings> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Find the integration for the current tenant
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					name: IntegrationEnum.MakeCom,
					tenantId
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				throw new NotFoundException(`${IntegrationEnum.MakeCom} integration not found for this tenant`);
			}

			const updates = [];

			// Update isEnabled setting if provided
			if (input.isEnabled !== undefined) {
				let enabledSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
				);
				if (enabledSetting) {
					enabledSetting.settingsValue = input.isEnabled.toString();
				} else {
					enabledSetting = {
						settingsName: MakeSettingName.IS_ENABLED,
						settingsValue: input.isEnabled.toString(),
						integration: integrationTenant
					};
				}
				updates.push(this.integrationSettingService.save(enabledSetting));
			}

			// Update webhookUrl setting if provided
			if (input.webhookUrl !== undefined) {
				let webhookUrlSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.WEBHOOK_URL
				);
				if (webhookUrlSetting) {
					webhookUrlSetting.settingsValue = input.webhookUrl;
				} else {
					webhookUrlSetting = {
						settingsName: MakeSettingName.WEBHOOK_URL,
						settingsValue: input.webhookUrl,
						integration: integrationTenant
					};
				}
				updates.push(this.integrationSettingService.save(webhookUrlSetting));
			}

			// Wait for all updates to complete
			await Promise.all(updates);

			// Return the updated settings
			return this.getIntegrationSettings();
		} catch (error) {
			this.logger.error('Error updating Make.com integration settings:', error);
			throw error;
		}
	}

	/**
	 * Saves OAuth credentials for the Make.com integration.
	 * This method stores the credentials in the database for persistence across server restarts.
	 *
	 * @param {Object} credentials - The OAuth credentials to save.
	 * @param {string} credentials.clientId - The OAuth client ID.
	 * @param {string} credentials.clientSecret - The OAuth client secret.
	 * @returns {Promise<void>} A promise that resolves when the credentials have been saved.
	 */
	async saveOAuthCredentials(credentials: { clientId: string; clientSecret: string }): Promise<void> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Find the integration for the current tenant
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					name: IntegrationEnum.MakeCom,
					tenantId
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				throw new NotFoundException(`${IntegrationEnum.MakeCom} integration not found for this tenant`);
			}

			// Define the settings to be saved or updated
			const settingsToSave = [
				{
					settingsName: MakeSettingName.CLIENT_ID,
					settingsValue: credentials.clientId,
					integration: integrationTenant
				},
				{
					settingsName: MakeSettingName.CLIENT_SECRET,
					settingsValue: credentials.clientSecret,
					integration: integrationTenant
				}
			];

			// Use the bulkUpdateOrCreate method to save the settings
			await this.integrationSettingService.bulkUpdateOrCreate(
				integrationTenant.id,
				settingsToSave,
			);

			this.logger.log(`OAuth credentials updated for tenant: ${tenantId}`);
		} catch (error) {
			this.logger.error('Error saving Make.com OAuth credentials:', error);
			throw error;
		}
	}

	/**
 * Retrieves the OAuth credentials for the Make.com integration.
 *
 * @param {string} integrationId - The ID of the integration to get credentials for.
 * @returns {Promise<{clientId: string, clientSecret: string}>} A promise that resolves to the OAuth credentials.
 */
async getOAuthCredentials(integrationId: string): Promise<{ clientId: string; clientSecret: string }> {
	try {
		// Find the integration settings
		const settings = await this.integrationSettingService.find({
			where: {
				integration: { id: integrationId },
				settingsName: In([
					MakeSettingName.CLIENT_ID,
					MakeSettingName.CLIENT_SECRET
				])
			}
		});

		if (!settings || settings.length < 2) {
			throw new NotFoundException('OAuth credentials not found for this integration');
		}

		// Extract client ID and client secret
		const clientIdSetting = settings.find(setting => setting.settingsName === MakeSettingName.CLIENT_ID);
		const clientSecretSetting = settings.find(setting => setting.settingsName === MakeSettingName.CLIENT_SECRET);

		if (!clientIdSetting || !clientSecretSetting) {
			throw new NotFoundException('OAuth credentials are incomplete for this integration');
		}

		return {
			clientId: clientIdSetting.settingsValue,
			clientSecret: clientSecretSetting.settingsValue
		};
	} catch (error) {
		this.logger.error('Error retrieving Make.com OAuth credentials:', error);
		throw error;
	}
}

	/**
	 * Retrieves the OAuth client ID for the Make.com integration.
	 *
	 * @returns {Promise<string>} A promise that resolves to the OAuth client ID or null if not found.
	 */
	async getOAuthClientId(): Promise<string | null> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Find the integration for the current tenant
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					name: IntegrationEnum.MakeCom,
					tenantId
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				return null;
			}

			// Find the client ID setting
			const clientIdSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.CLIENT_ID
			);

			return clientIdSetting ? clientIdSetting.settingsValue : null;
		} catch (error) {
			this.logger.error('Error retrieving Make.com OAuth client ID:', error);
			throw error;
		}
	}

	/**
	 * Makes an authenticated API call to Make.com.
	 *
	 * @param {string} makeApiUrl - The Make.com API endpoint.
	 * @param {string} method - The HTTP method to use.
	 * @param {any} data - The data to send with the request.
	 * @returns {Promise<any>} - The API response.
	 */
	async makeApiCall(
		makeApiUrl: string,
		method: string = 'GET',
		data: any = null,
		retryLimit = 1,
		preloadedIntegration?: any // Add optional parameter for pre-loaded integration
	): Promise<any> {
		try {
			// Use preloaded integration if available, otherwise fallback to DB lookup
			if (!preloadedIntegration) {
				const tenantId = RequestContext.currentTenantId();
				if (!tenantId) {
					throw new NotFoundException('Tenant ID not found in request context');
				}
			}
			// Safely retrieve the Express request and context
			const req = RequestContext.currentRequest();
			if (!req) {
				// No request context-fallback to DB lookup
				const dbSettings = await this.getIntegrationSettings();
				const settingsMap = Object.fromEntries(Object.entries(dbSettings));
				const accessToken = settingsMap[MakeSettingName.ACCESS_TOKEN];
				if (!accessToken) {
					throw new NotFoundException('Access token not found for Make.com integration');
				}
				return accessToken;
				}

				const integration = req.integration;
			if (!integration || integration.name !== IntegrationEnum.MakeCom) {
				throw new NotFoundException(`${IntegrationEnum.MakeCom} integration not found in request context`);
				}

			 // Middleware already converts IIntegrationSetting[] → Record via arrayToObject,
			// but if you ever bypass it, this guard ensures it’s a map:
			const settingsObj = Array.isArray(integration.settings)
			? Object.fromEntries(integration.settings.map(s => [s.settingsName, s.settingsValue]))
			: integration.settings;
			const accessToken = settingsObj[MakeSettingName.ACCESS_TOKEN];

			if (!accessToken) {
				throw new NotFoundException('Access token not found for Make.com integration');
			}

			const headers = {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			};

			const requestConfig = { headers };
			let response;

			switch (method.toUpperCase()) {
				case 'GET':
					response = await firstValueFrom(
						this.httpService
							.get(makeApiUrl, requestConfig)
							.pipe(
								catchError((error: AxiosError) =>
									this.handleApiError(
										error,
										integration.id,
										makeApiUrl,
										method,
										data,
										retryLimit
									)
								)
							)
					);
					break;
				case 'POST':
					response = await firstValueFrom(
						this.httpService
							.post(makeApiUrl, data, requestConfig)
							.pipe(
								catchError((error: AxiosError) =>
									this.handleApiError(
										error,
										integration.id,
										makeApiUrl,
										method,
										data,
										retryLimit
									)
								)
							)
					);
					break;
				case 'PUT':
					response = await firstValueFrom(
						this.httpService
							.put(makeApiUrl, data, requestConfig)
							.pipe(
								catchError((error: AxiosError) =>
									this.handleApiError(
										error,
										integration.id,
										makeApiUrl,
										method,
										data,
										retryLimit
									)
								)
							)
					);
					break;
				case 'DELETE':
					response = await firstValueFrom(
						this.httpService
							.delete(makeApiUrl, requestConfig)
							.pipe(
								catchError((error: AxiosError) =>
									this.handleApiError(
										error,
										integration.id,
										makeApiUrl,
										method,
										data,
										retryLimit
									)
								)
							)
					);
					break;
				default:
					throw new Error(`Unsupported HTTP method: ${method}`);
			}
			return response.data;
		} catch (error) {
			this.logger.error(`Error making API call to Make.com: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Handles token refresh when an API call fails due to token expiration.
	 *
	 * @param {string} integrationId - The integration ID.
	 * @param {string} makeApiUrl - The makeApiUrl to retry after token refresh.
	 * @param {string} method - The HTTP method to use.
	 * @param {any} data - The data to send with the request.
	 * @param {number} retryLimit - The maximum number of retries allowed.
	 * @returns {Promise<any>} - The API response after token refresh.
	 */
	private async handleTokenRefresh(
		integrationId: string,
		makeApiUrl: string,
		method: string,
		data: any,
		retryLimit: number = 1
	): Promise<any> {
		if (retryLimit <= 0) {
			throw new Error('Token refresh retry limit exceeded');
		}

		try {
			// Refresh the token
			await this.makeComOAuthService.refreshToken(integrationId);

			// Retry the API call with the new token
			return this.makeApiCall(makeApiUrl, method, data, retryLimit - 1);
		} catch (error) {
			this.logger.error('Failed to refresh token:', error);
			throw error;
		}
	}

	/**
	 * Handles API call errors, including token expiration.
	 *
	 * @param {AxiosError} error - The error object from the API call.
	 * @param {string} integrationId - The integration ID.
	 * @param {string} makeApiUrl - The Make.com API endpoint.
	 * @param {string} method - The HTTP method to use.
	 * @param {any} data - The data to send with the request.
	 * @param {number} retryLimit - The maximum number of retries allowed.
	 * @returns {Promise<any>} - The API response after handling the error.
	 */
	private async handleApiError(
		error: any,
		integrationId: string,
		makeApiUrl: string,
		method: string,
		data: any,
		retryLimit: number
	): Promise<any> {
		// Handle token expiration (common HTTP statuses and OAuth error codes)
		const status = error.response?.status;
		const oauthError = error.response?.data?.error || error.response?.data?.error_description;
		if (
			status === 401 ||
			status === 403 ||
			status === 400 ||
			['invalid_token', 'invalid_grant'].includes(oauthError)
		) {
			return this.handleTokenRefresh(integrationId, makeApiUrl, method, data, retryLimit);
		}
		throw error;
	}
}
