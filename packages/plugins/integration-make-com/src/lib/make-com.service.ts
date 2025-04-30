import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationSettingService, IntegrationTenantService, RequestContext } from '@gauzy/core';
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
	async makeApiCall(makeApiUrl: string, method: string = 'GET', data: any = null, retryLimit = 1): Promise<any> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Accept the already-loaded integration tenant as an optional parameter
			// This is useful for cases where the integration tenant is already loaded
			// and we don't want to query the database again.
			let integrationTenant = RequestContext.currentIntegrationTenant();

			// Only lookup if not provided
			if (!integrationTenant) {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						name: IntegrationEnum.MakeCom,
						tenantId
					},
					relations: ['settings']
				});
			}

			if (!integrationTenant) {
				throw new NotFoundException(`${IntegrationEnum.MakeCom} integration not found for this tenant`);
			}

			// Get the access token
			const accessTokenSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.ACCESS_TOKEN
			);

			if (!accessTokenSetting) {
				throw new NotFoundException('Access token not found for Make.com integration');
			}

			const headers = {
				Authorization: `Bearer ${accessTokenSetting.settingsValue}`,
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
										integrationTenant.id,
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
										integrationTenant.id,
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
										integrationTenant.id,
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
										integrationTenant.id,
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
		error: AxiosError,
		integrationId: string,
		makeApiUrl: string,
		method: string,
		data: any,
		retryLimit: number
	): Promise<any> {
		// Handle token expiration
		if (error.response?.status === 401) {
			return this.handleTokenRefresh(integrationId, makeApiUrl, method, data, retryLimit);
		}
		throw error;
	}
}
