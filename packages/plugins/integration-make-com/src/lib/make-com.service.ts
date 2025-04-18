import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
	IntegrationSettingService,
	IntegrationTenantService,
	RequestContext
} from '@gauzy/core';
import { IMakeComIntegrationSettings, MakeSettingName, IntegrationEnum } from '@gauzy/contracts';
import { MakeComOAuthService } from './make-com-oauth.service';

@Injectable()
export class MakeComService {
	private readonly logger = new Logger(MakeComService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationTenantService: IntegrationTenantService,
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
				const enabledSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
				);
				if (enabledSetting) {
					enabledSetting.settingsValue = input.isEnabled.toString();
					updates.push(this.integrationSettingService.create(enabledSetting));
				}
			}

			// Update webhookUrl setting if provided
			if (input.webhookUrl !== undefined) {
				const webhookUrlSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.WEBHOOK_URL
				);
				if (webhookUrlSetting) {
					webhookUrlSetting.settingsValue = input.webhookUrl;
					updates.push(this.integrationSettingService.create(webhookUrlSetting));
				}
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
	 * Makes an authenticated API call to Make.com.
	 *
	 * @param {string} makeApiUrl - The Make.com API endpoint.
	 * @param {string} method - The HTTP method to use.
	 * @param {any} data - The data to send with the request.
	 * @returns {Promise<any>} - The API response.
	 */
	async makeApiCall(makeApiUrl: string, method: string = 'GET', data: any = null): Promise<any> {
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

			// Get the access token
			const accessTokenSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === 'access_token'
			);

			if (!accessTokenSetting) {
				throw new NotFoundException('Access token not found for Make.com integration');
			}

			const headers = {
				Authorization: `Bearer ${accessTokenSetting.settingsValue}`,
				'Content-Type': 'application/json'
			};

			let response;
			switch (method.toUpperCase()) {
				case 'GET':
					response = await firstValueFrom(
						this.httpService.get(makeApiUrl, { headers }).pipe(
							catchError((error: AxiosError) => {
								// Handle token expiration
								if (error.response?.status === 401) {
									// Token might be expired, try refreshing
									return this.handleTokenRefresh(integrationTenant.id, makeApiUrl, method, data);
								}
								throw error;
							})
						)
					);
					break;
				case 'POST':
					response = await firstValueFrom(
						this.httpService.post(makeApiUrl, data, { headers }).pipe(
							catchError((error: AxiosError) => {
								if (error.response?.status === 401) {
									return this.handleTokenRefresh(integrationTenant.id, makeApiUrl, method, data);
								}
								throw error;
							})
						)
					);
					break;
				case 'PUT':
					response = await firstValueFrom(
						this.httpService.put(makeApiUrl, data, { headers }).pipe(
							catchError((error: AxiosError) => {
								if (error.response?.status === 401) {
									return this.handleTokenRefresh(integrationTenant.id, makeApiUrl, method, data);
								}
								throw error;
							})
						)
					);
					break;
				case 'DELETE':
					response = await firstValueFrom(
						this.httpService.delete(makeApiUrl, { headers }).pipe(
							catchError((error: AxiosError) => {
								if (error.response?.status === 401) {
									return this.handleTokenRefresh(integrationTenant.id, makeApiUrl, method, data);
								}
								throw error;
							})
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
	 * @returns {Promise<any>} - The API response after token refresh.
	 */
	private async handleTokenRefresh(
		integrationId: string,
		makeApiUrl: string,
		method: string,
		data: any
	): Promise<any> {
		try {
			// Refresh the token
			await this.makeComOAuthService.refreshToken(integrationId);

			// Retry the API call with the new token
			return this.makeApiCall(makeApiUrl, method, data);
		} catch (error) {
			this.logger.error('Failed to refresh token:', error);
			throw error;
		}
	}
}
