import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError, AxiosResponse } from 'axios';
import { DeepPartial } from 'typeorm';
import { catchError, firstValueFrom, lastValueFrom, map, switchMap } from 'rxjs';
import {
	IIntegrationTenant,
	IntegrationEnum,
	IntegrationEntity,
	IIntegrationSetting,
	IIntegrationEntitySetting,
	ID,
	ICreateZapierIntegrationInput,
	IZapierEndpoint,
} from '@gauzy/contracts';
import {
	IntegrationSettingService,
	IntegrationService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES
} from '@gauzy/core';
import { ZAPIER_AUTHORIZATION_URL } from './zapier.config';

@Injectable()
export class ZapierService {
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
					const response = error.response || { status: HttpStatus.INTERNAL_SERVER_ERROR };

					throw new HttpException({ message: error.message, error }, response.status);
				}),
				map((response: AxiosResponse<T>) => response.data)
			)
		);
	}

	/**
	 * Refresh the access token for the specified integration.
	 *
	 * @param {ID} integrationId - The ID of the integration.
	 * @returns {Promise<any>} - The new tokens.
	 */
	async refreshToken(integrationId: ID): Promise<any> {
		const settings = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId },
				integrationId
			}
		});
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};

		const urlParams = new URLSearchParams();

		const { client_id, client_secret, refresh_token } = settings.reduce(
			(prev, current) => {
				return {
					...prev,
					client_id: current.settingsName === 'client_id' ? current.settingsValue : prev.client_id,
					client_secret:
						current.settingsName === 'client_secret' ? current.settingsValue : prev.client_secret,
					refresh_token: current.settingsName === 'refresh_token' ? current.settingsValue : prev.refresh_token
				};
			},
			{
				client_id: '',
				client_secret: '',
				refresh_token: ''
			}
		);
		if (!client_id || !client_secret || !refresh_token) {
			throw new BadRequestException('Missing required zapier integration settings')
		}

		urlParams.append('grant_type', 'refresh_token');
		urlParams.append('refresh_token', refresh_token);
		urlParams.append('client_id', client_id);
		urlParams.append('client_secret', client_secret);

		try {
			const tokens$ = this._httpService
				.post(`${ZAPIER_AUTHORIZATION_URL}/access_tokens`, urlParams, {
					headers
				})
				.pipe(map((response: AxiosResponse<any>) => response.data));
			const tokens = await lastValueFrom(tokens$);
			const settingsDto = settings.map((setting) => {
				if (setting.settingsName === 'access_token') {
					setting.settingsValue = tokens.access_token;
				}

				if (setting.settingsName === 'refresh_token') {
					setting.settingsValue = tokens.refresh_token;
				}

				return setting;
			}) as DeepPartial<IIntegrationSetting>;

			await this._integrationSettingService.create(settingsDto);
			return tokens;
		} catch (error) {
			throw new BadRequestException(error);
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
	 * Adds a new Zapier integration.
	 *
	 * @param {ICreateZapierIntegrationInput} body - The input data for creating a Zapier integration.
	 * @returns {Promise<IIntegrationTenant>} - The created or updated integration tenant.
	 */
	async addIntegration(body: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId() || undefined;
		const { client_id, client_secret, code, redirect_uri, organizationId } = body;

		const urlParams = new URLSearchParams();
		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		const integration =
			(await this._integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.ZAPIER }
			})) || undefined;

		const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
			...entity,
			organizationId,
			tenantId
		}));

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

		const tokens$ = this._httpService
			.post(`${ZAPIER_AUTHORIZATION_URL}/access_tokens`, urlParams, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			})
			.pipe(
				switchMap(({ data }) =>
					this._commandBus.execute(
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
										settingsValue: data.access_token
									},
									{
										settingsName: 'refresh_token',
										settingsValue: data.refresh_token
									}
								].map((setting) => ({
									...setting,
									tenantId,
									organizationId
								}))
							}
						)
					)
				),
				catchError((error) => {
					throw new BadRequestException(error);
				})
			);

		return await lastValueFrom(tokens$);
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
}
