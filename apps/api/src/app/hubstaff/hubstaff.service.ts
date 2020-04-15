import { Injectable, HttpService, BadRequestException } from '@nestjs/common';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
	ICreateIntegrationDto,
	IIntegration,
	IntegrationEnum,
	IHubstaffOrganization,
	IHubstaffProject,
	IntegrationEntity,
	IIntegrationMap
} from '@gauzy/models';
import { IntegrationService } from '../integration/integration.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';

@Injectable()
export class HubstaffService {
	constructor(
		private _httpService: HttpService,
		private _integrationService: IntegrationService,
		private _integrationSettingService: IntegrationSettingService,
		private _organizationProjectService: OrganizationProjectsService,
		private _integrationMapService: IntegrationMapService
	) {}

	async getHubstaffToken(integrationId): Promise<string> {
		const {
			record: integrationSetting
		} = await this._integrationSettingService.findOneOrFail({
			where: {
				integration: { id: integrationId },
				settingsName: 'access_token'
			}
		});
		return integrationSetting;
	}

	async addIntegration(body: ICreateIntegrationDto): Promise<IIntegration> {
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		const { client_id, client_secret, tenantId, code, redirect_uri } = body;
		const urlParams = new URLSearchParams();

		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		return this._httpService
			.post('https://account.hubstaff.com/access_tokens', urlParams, {
				headers
			})
			.pipe(
				switchMap(({ data }) =>
					this._integrationService.addIntegration({
						tenantId,
						name: IntegrationEnum.HUBSTAFF,
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
						]
					})
				),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	async getOrganizations(
		{ token },
		integrationId: string
	): Promise<IHubstaffOrganization[]> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		return this._httpService
			.get('https://api.hubstaff.com/v2/organizations', { headers })
			.pipe(
				map((response) => response.data),
				map(({ organizations }) => organizations),
				catchError((err) => {
					// add retry logic and refresh token
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	async getProjects(
		organizationId,
		token: string
	): Promise<IHubstaffProject[]> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		return this._httpService
			.get(
				`https://api.hubstaff.com/v2/organizations/${organizationId}/projects?status=all`,
				{ headers }
			)
			.pipe(
				map((response) => response.data),
				map(({ projects }) => projects),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	async syncProjects({
		integrationId,
		orgId,
		projects
	}): Promise<IIntegrationMap[]> {
		const integrationMaps = await projects.map(
			async ({ name, sourceId }) => {
				const gauzyProject = await this._organizationProjectService.create(
					{
						name,
						organizationId: orgId,
						public: true,
						type: 'RATE',
						currency: 'BGN'
					}
				);
				const {
					record: integration
				} = await this._integrationService.findOneOrFail(integrationId);

				return await this._integrationMapService.create({
					gauzyId: gauzyProject.id,
					integration,
					sourceId,
					entity: IntegrationEntity.PROJECT
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	private async _refreshTokenAndRetry(integrationId, token) {
		const {
			record: integrationSetting
		} = await this._integrationSettingService.findOneOrFail({
			where: {
				integration: { id: integrationId },
				settingsName: 'refresh_token'
			}
		});
		console.log(integrationSetting, 'SETTING');
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${token}`
		};

		const urlParams = new URLSearchParams();

		urlParams.append('grant_type', 'refresh_token');
		urlParams.append('refresh_token', integrationSetting.settingsValue);

		try {
			const tokens = await this._httpService
				.post('https://account.hubstaff.com/access_tokens', urlParams, {
					headers
				})
				.toPromise();

			console.log(tokens);
		} catch (error) {
			console.log(error, 'ERROR IN CATCH');
			throw new BadRequestException(error);
		}
	}
}
