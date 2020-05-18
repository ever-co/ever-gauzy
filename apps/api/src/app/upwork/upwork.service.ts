import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as UpworkApi from 'upwork-api';
import { environment } from '@env-api/environment';
import {
	IAccessTokenSecretPair,
	IAccessToken,
	IAccessTokenDto,
	IntegrationEnum
} from '@gauzy/models';
import { IntegrationTenantCreateCommand } from '../integration-tenant/commands';
import {
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingCreateCommand
} from '../integration-setting/commands';
import { arrayToObject } from '../core';

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
				integrationId: integrationSetting.id,
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
}
