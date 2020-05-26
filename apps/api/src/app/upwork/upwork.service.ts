import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as UpworkApi from 'upwork-api';
import { environment } from '@env-api/environment';
import {
	IAccessTokenSecretPair,
	IAccessToken,
	IAccessTokenDto,
	IntegrationEnum,
	IGetContractsDto,
	IGetWorkDiaryDto,
	IEngagement,
	IUpworkApiConfig,
	IIntegrationMap,
	CurrenciesEnum,
	ProjectTypeEnum
} from '@gauzy/models';
import {
	IntegrationTenantCreateCommand,
	IntegrationTenantGetCommand
} from '../integration-tenant/commands';
import {
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingCreateCommand
} from '../integration-setting/commands';
import { arrayToObject } from '../core';
import { Engagements } from 'upwork-api/lib/routers/hr/engagements.js';
import { Workdiary } from 'upwork-api/lib/routers/workdiary.js';
import { IntegrationMapSyncProjectCommand } from '../integration-map/commands';

@Injectable()
export class UpworkService {
	private _upworkApi: UpworkApi;

	constructor(private commandBus: CommandBus) {}

	private async _consumerHasAccessToken(consumerKey: string) {
		const integrationSetting = await this.commandBus.execute(
			new IntegrationSettingGetCommand({
				where: { settingsValue: consumerKey },
				relations: ['integration']
			})
		);
		if (!integrationSetting) {
			return false;
		}

		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: { integration: integrationSetting.integration }
			})
		);
		const integrationSettingMap = arrayToObject(
			integrationSettings,
			'settingsName',
			'settingsValue'
		);

		if (
			integrationSettingMap.accessToken &&
			integrationSettingMap.accessTokenSecret
		) {
			return {
				integrationId: integrationSetting.integration.id,
				...integrationSettingMap
			};
		}

		return false;
	}

	async getAccessTokenSecretPair(config): Promise<IAccessTokenSecretPair> {
		const consumerAcessToken = await this._consumerHasAccessToken(
			config.consumerKey
		);

		// access token live forever, if user already registered app, retern the access token;
		if (consumerAcessToken) {
			return consumerAcessToken;
		}

		this._upworkApi = new UpworkApi(config);

		return new Promise((resolve, reject) => {
			this._upworkApi.getAuthorizationUrl(
				environment.upworkConfig.callbackUrl,
				async (error, url, requestToken, requestTokenSecret) => {
					if (error)
						reject(`can't get authorization url, error: ${error}`);

					await this.commandBus.execute(
						new IntegrationTenantCreateCommand({
							name: IntegrationEnum.UPWORK,
							entitySettings: [],
							settings: [
								{
									settingsName: 'consumerKey',
									settingsValue: config.consumerKey
								},
								{
									settingsName: 'consumerSecret',
									settingsValue: config.consumerSecret
								},
								{
									settingsName: 'requestToken',
									settingsValue: requestToken
								},
								{
									settingsName: 'requestTokenSecret',
									settingsValue: requestTokenSecret
								}
							]
						})
					);
					return resolve({ url, requestToken, requestTokenSecret });
				}
			);
		});
	}

	getAccessToken({
		requestToken,
		verifier
	}: IAccessTokenDto): Promise<IAccessToken> {
		return new Promise(async (resolve, reject) => {
			const { integration } = await this.commandBus.execute(
				new IntegrationSettingGetCommand({
					where: { settingsValue: requestToken },
					relations: ['integration']
				})
			);

			const integrationSettings = await this.commandBus.execute(
				new IntegrationSettingGetManyCommand({
					where: { integration }
				})
			);
			const integrationSetting = arrayToObject(
				integrationSettings,
				'settingsName',
				'settingsValue'
			);

			this._upworkApi.getAccessToken(
				requestToken,
				integrationSetting.requestTokenSecret,
				verifier,
				async (error, accessToken, accessTokenSecret) => {
					if (error) reject(new Error(error));
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessToken',
							settingsValue: accessToken
						})
					);
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessTokenSecret',
							settingsValue: accessTokenSecret
						})
					);

					resolve({
						integrationId: integration.id,
						accessToken,
						accessTokenSecret
					});
				}
			);
		});
	}

	async getConfig(integrationId): Promise<IUpworkApiConfig> {
		const integration = await this.commandBus.execute(
			new IntegrationTenantGetCommand({ where: { id: integrationId } })
		);
		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: { integration }
			})
		);
		const {
			accessToken,
			consumerKey,
			consumerSecret,
			accessTokenSecret: accessSecret
		} = arrayToObject(integrationSettings, 'settingsName', 'settingsValue');

		return { accessToken, consumerKey, consumerSecret, accessSecret };
	}

	// engagement has access to contract ID, this is a project in gauzy
	async getContractsForFreelancer(
		getEngagementsDto: IGetContractsDto
	): Promise<IEngagement[]> {
		const api = new UpworkApi(getEngagementsDto.config);
		const engagements = new Engagements(api);
		const params = {};
		return new Promise((resolve, reject) => {
			api.setAccessToken(
				getEngagementsDto.config.accessToken,
				getEngagementsDto.config.accessSecret,
				() => {
					engagements.getList(params, (error, data) => {
						if (error) {
							reject(error);
						} else {
							const {
								engagements: { engagement }
							} = data;
							resolve(engagement);
						}
					});
				}
			);
		});
	}

	async syncContracts({
		integrationId,
		organizationId,
		contracts
	}): Promise<IIntegrationMap[]> {
		return await Promise.all(
			await contracts.map(
				async ({ job__title: name, reference: sourceId }) => {
					return await this.commandBus.execute(
						new IntegrationMapSyncProjectCommand({
							organizationProjectCreateInput: {
								name,
								organizationId,
								public: true,
								type: ProjectTypeEnum.RATE,
								currency: CurrenciesEnum.BGN
							},
							integrationId,
							sourceId
						})
					);
				}
			)
		);
	}

	// work diary holds information for time slots and time logs
	async getWorkDiary(getWorkDiaryDto: IGetWorkDiaryDto) {
		const api = new UpworkApi(getWorkDiaryDto.config);
		const workdiary = new Workdiary(api);
		const params = {
			offset: 0
		};
		return new Promise((resolve, reject) => {
			workdiary.getByContract(
				getWorkDiaryDto.contractId,
				getWorkDiaryDto.forDate,
				params,
				(err, data) => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				}
			);
		});
		// insert in the appropiate entities, timeslot,time log and store ids in integration_tenant
	}
}
