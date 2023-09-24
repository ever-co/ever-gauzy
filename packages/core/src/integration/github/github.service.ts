import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '@gauzy/config';
import { IGithubAppInstallInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { IntegrationTenantFirstOrCreateCommand } from 'integration-tenant/commands';
import { IntegrationService } from 'integration/integration.service';
import { RequestContext } from '../../core/context';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';

const { github } = environment;

@Injectable()
export class GithubService {
	private readonly logger = new Logger('GithubService');

	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationService: IntegrationService
	) { }

	async openIssue({ title, body, owner, repo, installationI }) {
		console.log({ title, body, owner, repo, installationI });
	}

	async editIssue({ issueNumber, title, body, owner, repo, installationI }) {
		console.log({ issueNumber, title, body, owner, repo, installationI });
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async addGithubAppInstallation(input: IGithubAppInstallInput) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.installation_id || !input.setup_action) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}

			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { installation_id, setup_action, organizationId } = input;

			/** Find the GitHub integration */
			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GITHUB
				}
			});

			/** Execute the command to create the integration tenant settings */
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
							settingsName: 'installation_id',
							settingsValue: installation_id
						},
						{
							settingsName: 'setup_action',
							settingsValue: setup_action
						},
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
	 *
	 * @param input
	 * @returns
	 */
	async oAuthEndpointAuthorization(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.code) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}

			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { code, organizationId } = input;

			const integration = await this._integrationService.findOneByOptions({
				where: {
					name: IntegrationEnum.GITHUB
				}
			});

			const urlParams = new URLSearchParams();
			urlParams.append('client_id', github.CLIENT_ID);
			urlParams.append('client_secret', github.CLIENT_SECRET);
			urlParams.append('code', code);

			const tokens$ = this._httpService.post(GITHUB_ACCESS_TOKEN_URL, urlParams, {
				headers: {
					'accept': 'application/json'
				}
			}).pipe(
				filter(({ data }) => !!data.error),
				switchMap(({ data }) => this._commandBus.execute(
					new IntegrationTenantFirstOrCreateCommand(
						{
							name: IntegrationEnum.GITHUB,
							integration: {
								provider: IntegrationEnum.GITHUB
							},
							tenantId,
							organizationId,
						},
						{
							name: IntegrationEnum.GITHUB,
							integration,
							tenantId,
							organizationId,
							entitySettings: [],
							settings: [
								{
									settingsName: 'token_type',
									settingsValue: data.token_type
								},
								{
									settingsName: 'access_token',
									settingsValue: data.access_token
								},
								{
									settingsName: 'scope',
									settingsValue: data.scope
								}
							].map((setting) => ({
								...setting,
								tenantId,
								organizationId,
							}))
						}
					)
				)),
				catchError((error) => {
					throw new BadRequestException(error);
				})
			);
			return await lastValueFrom(tokens$);
		} catch (error) {
			this.logger.error('Error while creating GitHub integration settings', error?.message);
			throw new Error('Failed to add GitHub App Installation');
		}
	}
}
