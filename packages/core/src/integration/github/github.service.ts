import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, switchMap } from 'rxjs';
import { environment } from '@gauzy/config';
import {
	GithubPropertyMapEnum,
	IGithubAppInstallInput,
	IGithubSyncIssuePayload,
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied,
	IIntegrationMap,
	IIntegrationTenant,
	IOAuthAppInstallInput,
	IntegrationEntity,
	IntegrationEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { IntegrationTenantFirstOrCreateCommand } from 'integration-tenant/commands';
import { IntegrationService } from 'integration/integration.service';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';
import { DEFAULT_ENTITY_SETTINGS, PROJECT_TIED_ENTITIES } from './github-entity-settings';
import { IntegrationMapSyncIssueCommand } from 'integration-map/commands';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
const { github } = environment;

@Injectable()
export class GithubService {
	private readonly logger = new Logger('GithubService');

	constructor(
		private readonly _http: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationService: IntegrationService,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	async openIssue({ title, body, owner, repo, installationI }) {
		console.log({ title, body, owner, repo, installationI });
	}

	async editIssue({ issueNumber, title, body, owner, repo, installationI }) {
		console.log({ issueNumber, title, body, owner, repo, installationI });
	}

	/**
	 * Adds a GitHub App installation by validating input data, fetching an access token, and creating integration tenant settings.
	 *
	 * @param input - The input data for adding a GitHub App installation.
	 * @returns A promise that resolves to the access token data.
	 * @throws Error if any step of the process fails.
	 */
	public async addGithubAppInstallation(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.installation_id || !input.setup_action) {
				throw new HttpException('Invalid github input data', HttpStatus.BAD_REQUEST);
			}

			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { installation_id, setup_action, organizationId } = input;

			/** Find the GitHub integration */
			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GITHUB
				}
			});

			const tiedEntities = PROJECT_TIED_ENTITIES.map(entity => ({
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
			});

			return await this._commandBus.execute(
				new IntegrationTenantFirstOrCreateCommand({
					name: IntegrationEnum.GITHUB,
					integration: {
						provider: IntegrationEnum.GITHUB
					},
					tenantId,
					organizationId,
				}, {
					name: IntegrationEnum.GITHUB,
					integration,
					tenantId,
					organizationId,
					entitySettings: entitySettings,
					settings: [
						{
							settingsName: GithubPropertyMapEnum.INSTALLATION_ID,
							settingsValue: installation_id
						},
						{
							settingsName: GithubPropertyMapEnum.SETUP_ACTION,
							settingsValue: setup_action
						}
					].map((setting) => ({
						...setting,
						tenantId,
						organizationId,
					}))
				})
			);
		} catch (error) {
			this.logger.error(`Error while creating ${IntegrationEnum.GAUZY_AI} integration settings`, error?.message);
			throw new Error(`Failed to add ${IntegrationEnum.GAUZY_AI} App Installation`);
		}
	}

	/**
	 * Authorizes a GitHub App installation by validating input data, fetching an access token, and creating integration tenant settings.
	 *
	 * @param input - The input data required for OAuth authorization.
	 * @returns A promise that resolves with the integration tenant data.
	 * @throws {HttpException} If input data is invalid or if any step of the process fails.
	 */
	async oAuthEndpointAuthorization(input: IOAuthAppInstallInput): Promise<IIntegrationTenant> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.code) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}

			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { code, organizationId } = input;

			/** Find the GitHub integration */
			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GITHUB
				}
			});

			const urlParams = new URLSearchParams();
			urlParams.append('client_id', github.clientId);
			urlParams.append('client_secret', github.clientSecret);
			urlParams.append('code', code);

			const tokens$ = this._http.post(GITHUB_ACCESS_TOKEN_URL, urlParams, {
				headers: {
					'accept': 'application/json'
				}
			}).pipe(
				switchMap(async ({ data }) => {
					if (!data.error) {
						// Token retrieval was successful, return the token data
						return await this._commandBus.execute(
							new IntegrationTenantFirstOrCreateCommand({
								name: IntegrationEnum.GITHUB,
								integration: {
									provider: IntegrationEnum.GITHUB
								},
								tenantId,
								organizationId,
							}, {
								name: IntegrationEnum.GITHUB,
								integration,
								tenantId,
								organizationId,
								entitySettings: [],
								settings: [
									{
										settingsName: GithubPropertyMapEnum.ACCESS_TOKEN,
										settingsValue: data.access_token
									},
									{
										settingsName: GithubPropertyMapEnum.EXPIRES_IN,
										settingsValue: data.expires_in.toString()
									},
									{
										settingsName: GithubPropertyMapEnum.REFRESH_TOKEN,
										settingsValue: data.refresh_token
									},
									{
										settingsName: GithubPropertyMapEnum.REFRESH_TOKEN_EXPIRES_IN,
										settingsValue: data.refresh_token_expires_in.toString()
									},
									{
										settingsName: GithubPropertyMapEnum.TOKEN_TYPE,
										settingsValue: data.token_type
									}
								].map((setting) => ({
									...setting,
									tenantId,
									organizationId,
								}))
							})
						);
					} else {
						// Token retrieval failed, Throw an error to handle the failure
						throw new BadRequestException('Token retrieval failed', data);
					}
				})
			);
			return await firstValueFrom(tokens$);
		} catch (error) {
			// Handle errors and return an appropriate error response
			this.logger.error('Error while creating GitHub integration settings', error.message);
			throw new HttpException(`Failed to add GitHub App Installation: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Synchronize GitHub issues and labels.
	 *
	 * @param input - The payload containing information required for synchronization.
	 * @throws {Error} Throws an error if synchronization fails.
	 */
	public async syncGithubIssuesAndLabels(
		integrationId: IIntegrationTenant['id'],
		input: IGithubSyncIssuePayload
	): Promise<any> {
		try {
			const { organizationId, issues = [], visibility } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Retrieve integration settings tied to the specified organization
			const { entitySettings } = await this._integrationTenantService.findOneByIdString(integrationId, {
				where: {
					tenantId,
					organizationId
				},
				relations: {
					entitySettings: {
						tiedEntities: true
					}
				}
			});

			// Synchronize data based on entity settings
			return await Promise.all(
				entitySettings.map(async (setting) => {
					switch (setting.entity) {
						case IntegrationEntity.PROJECT:
							/**
							 * Issues Sync
							 */
							const issueSetting: IIntegrationEntitySetting = setting.tiedEntities.find(
								({ entity }: IIntegrationEntitySettingTied) => entity === IntegrationEntity.ISSUE
							);
							if (!!issueSetting && issueSetting.sync) {
								return issues.map(
									async ({ sourceId, number, title, state, body }) => {
										return await this._commandBus.execute(
											new IntegrationMapSyncIssueCommand({
												input: {
													title,
													number,
													description: body,
													status: state as TaskStatusEnum,
													public: visibility === 'private' ? false : true,
													organizationId,
													tenantId,
												},
												sourceId,
												integrationId,
												organizationId,
												tenantId
											})
										);
									}
								)
							}
					}
				})
			);
		} catch (error) {
			// Handle errors gracefully, for example, log them
			console.error('Error in syncGithubIssuesAndLabels:', error);
			throw new HttpException({ message: 'GitHub synchronization failed', error }, HttpStatus.BAD_REQUEST);
		}
	}
}
