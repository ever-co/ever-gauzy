import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, switchMap } from 'rxjs';
import { environment } from '@gauzy/config';
import {
	GithubPropertyMapEnum,
	IGithubAppInstallInput,
	IIntegrationTenant,
	IOAuthAppInstallInput,
	IntegrationEntity,
	IntegrationEnum,
	SYNC_TAG_GITHUB
} from '@gauzy/contracts';
import { IntegrationService, IntegrationTenantUpdateOrCreateCommand, RequestContext } from '@gauzy/core';
import { DEFAULT_ENTITY_SETTINGS, ISSUE_TIED_ENTITIES } from './github-entity-settings';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';

// Import the Probot configuration module
const { github } = environment;

@Injectable()
export class GithubService {
	private readonly logger = new Logger('GithubService');

	constructor(
		private readonly _http: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationService: IntegrationService
	) {}

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
				where: { provider: IntegrationEnum.GITHUB }
			});

			const tiedEntities = ISSUE_TIED_ENTITIES.map((entity) => ({
				...entity,
				organizationId,
				tenantId
			}));

			const entitySettings = DEFAULT_ENTITY_SETTINGS.map((settingEntity) => {
				if (settingEntity.entity === IntegrationEntity.ISSUE) {
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
				new IntegrationTenantUpdateOrCreateCommand(
					{
						name: IntegrationEnum.GITHUB,
						integration: { provider: IntegrationEnum.GITHUB },
						tenantId,
						organizationId
					},
					{
						name: IntegrationEnum.GITHUB,
						integration,
						tenantId,
						organizationId,
						entitySettings: entitySettings,
						isActive: true,
						isArchived: false,
						settings: [
							{
								settingsName: GithubPropertyMapEnum.INSTALLATION_ID,
								settingsValue: installation_id
							},
							{
								settingsName: GithubPropertyMapEnum.SETUP_ACTION,
								settingsValue: setup_action
							},
							{
								settingsName: GithubPropertyMapEnum.SYNC_TAG,
								settingsValue: SYNC_TAG_GITHUB
							}
						].map((setting) => ({
							...setting,
							tenantId,
							organizationId
						}))
					}
				)
			);
		} catch (error) {
			this.logger.error(`Error while creating ${IntegrationEnum.GITHUB} integration settings`, error?.message);
			throw new Error(`Failed to add ${IntegrationEnum.GITHUB} App Installation`);
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

			const tokens$ = this._http
				.post(GITHUB_ACCESS_TOKEN_URL, urlParams, {
					headers: {
						accept: 'application/json'
					}
				})
				.pipe(
					switchMap(async ({ data }) => {
						if (!data.error) {
							// Token retrieval was successful, return the token data
							return await this._commandBus.execute(
								new IntegrationTenantUpdateOrCreateCommand(
									{
										name: IntegrationEnum.GITHUB,
										integration: {
											provider: IntegrationEnum.GITHUB
										},
										tenantId,
										organizationId
									},
									{
										name: IntegrationEnum.GITHUB,
										integration,
										tenantId,
										organizationId,
										entitySettings: [],
										isActive: true,
										isArchived: false,
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
											organizationId
										}))
									}
								)
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
}
