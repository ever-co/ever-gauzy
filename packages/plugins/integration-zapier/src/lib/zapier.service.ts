import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { catchError, firstValueFrom, map } from 'rxjs';
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
	PROJECT_TIED_ENTITIES
} from '@gauzy/core';
import { ZAPIER_TOKEN_EXPIRATION_TIME } from './zapier.config';
import { ICreateZapierIntegrationInput, IZapierAccessTokens, IZapierEndpoint } from './zapier.types';

@Injectable()
export class ZapierService {
	private readonly logger = new Logger(ZapierService.name);
	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationSettingService: IntegrationSettingService,
		private readonly _integrationService: IntegrationService
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
						throw new HttpException(
							{ message: error.message, error },
							HttpStatus.INTERNAL_SERVER_ERROR
						);
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

			// Generate new tokens
			const access_token = uuidv4();
			const new_refresh_token = uuidv4();

			// Update settings with new tokens
			const updatedSettings = settings.map((setting) => {
				const updated = { ...setting };
				if (setting.settingsName === 'access_token') {
					updated.settingsValue = access_token;
				} else if (setting.settingsName === 'refresh_token') {
					updated.settingsValue = new_refresh_token;
				}
				return updated;
			}) as DeepPartial<IIntegrationEntitySetting>;

			await this._integrationSettingService.save(updatedSettings);

			this.logger.log(`Successfully refreshed tokens for integration ID ${integrationId}`, {
				integrationId,
				client_id,
				tenantId: settings[0]?.tenantId,
				organizationId: settings[0]?.organizationId
			});
			return {
				access_token,
				refresh_token: new_refresh_token,
				token_type: 'Bearer',
				expires_in: ZAPIER_TOKEN_EXPIRATION_TIME
			};
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
	 * Create Zapier integration with tokens for a user
	 *
	 * @param {ICreateZapierIntegrationInput} input - The input data for creating a Zapier integration.
	 * @returns Access and refresh tokens
	 */
	async createIntegration(input: ICreateZapierIntegrationInput & { userId: string }): Promise<IZapierAccessTokens> {
		const { client_id, client_secret, organizationId, tenantId, userId } = input;

		// Generate access token and refresh token
		const access_token = uuidv4();
		const refresh_token = uuidv4();

		// Create or find the existing integration
		const integration =
			(await this._integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.ZAPIER }
			})) || undefined;

		const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
			...entity,
			organizationId: organizationId || null,
			tenantId
		}));

		/**
		 * Map default entity settings to include organization and tenant IDs
		 * For PROJECT entity, also include tied entities
		 * This creates the entity settings configuration for the integration
		 */
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

		// Create integration tenant with settings
		await this._commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{
					name: IntegrationEnum.ZAPIER,
					integration: { provider: IntegrationEnum.ZAPIER },
					tenantId,
					organizationId
				},
				{
					name: IntegrationEnum.ZAPIER,
					integration,
					organizationId,
					tenantId,
					entitySettings: entitySettings,
					settings: [
						{
							settingsName: 'client_id',
							settingsValue: client_id
						},
						{
							settingsName: 'client_secret',
							settingsValue: client_secret
						},
						{
							settingsName: 'access_token',
							settingsValue: access_token
						},
						{
							settingsName: 'refresh_token',
							settingsValue: refresh_token
						},
						{
							settingsName: 'user_id',
							settingsValue: userId
						}
					].map((setting) => ({
						...setting,
						tenantId,
						organizationId
					}))
				}
			)
		);
		return {
			access_token,
			refresh_token,
			token_type: 'Bearer',
			expires_in: ZAPIER_TOKEN_EXPIRATION_TIME
		};
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
	 *
	 * 1. Looks up the integration setting named "access_token" matching the provided token.
	 * 2. Verifies that an integration ID was found.
	 * 3. Loads the integration tenant (filtered to Zapier) along with its settings.
	 * 4. Throws a NotFoundException if the token is invalid or no matching integration exists.
	 *
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
}
