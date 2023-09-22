import { IGithubAppInstallInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Context } from 'probot';
import { catchError, lastValueFrom, switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { IntegrationTenantCreateCommand } from 'integration-tenant/commands';
import { IntegrationService } from 'integration/integration.service';
import { RequestContext } from './../../core/context';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';

@Injectable()
export class GithubService {
	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationService: IntegrationService
	) { }

	/**
	 * ----- From GitHub to APIs -----
	 */

	async issuesOpened(context: Context) {
		console.log('Issue Created: ', context.payload);
		// TODO
		// Handle event processing
		// Find all the Projects connected to current repo and create new Task
	}
	async issuesEdited(context: Context) {
		console.log('Issue Edited', context.payload);
		// TODO
		// Handle event processing
		// Find all the Projects connected to current repo and edit task
		// To edit task we need to save issue_number of GitHub in task table
	}

	/**
	 * ----- From APIs to GitHub -----
	 */
	async openIssue(
		title: string,
		body: string,
		owner: string,
		repo: string,
		installationId: number
	) {
		// await this.gitHubIntegrationService.openIssue(
		// 	title,
		// 	body,
		// 	owner,
		// 	repo,
		// 	installationId
		// );
	}
	async editIssue(
		issueNumber: number,
		title: string,
		body: string,
		owner: string,
		repo: string,
		installationId: number
	) {
		// await this.gitHubIntegrationService.editIssue(
		// 	issueNumber,
		// 	title,
		// 	body,
		// 	repo,
		// 	owner,
		// 	installationId
		// );
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async addInstallationApp(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { installation_id, setup_action, organizationId } = input;

		const integration = await this._integrationService.findOneByOptions({
			where: {
				name: IntegrationEnum.GITHUB
			}
		});

		/** */
		return await this._commandBus.execute(
			new IntegrationTenantCreateCommand({
				name: IntegrationEnum.GITHUB,
				integration,
				tenantId,
				organizationId,
				entitySettings: [],
				settings: [
					{
						settingsName: 'installation_id',
						settingsValue: installation_id,
						tenantId,
						organizationId
					},
					{
						settingsName: 'setup_action',
						settingsValue: setup_action,
						tenantId,
						organizationId
					},
				]
			})
		);
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async oAuthEndpointAuthorization(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { code, organizationId } = input;

		if (!code) {
			throw new UnauthorizedException();
		}

		const integration = await this._integrationService.findOneByOptions({
			where: {
				name: IntegrationEnum.GITHUB
			}
		});

		const urlParams = new URLSearchParams();
		urlParams.append('client_id', process.env.GITHUB_CLIENT_ID);
		urlParams.append('client_secret', process.env.GITHUB_CLIENT_SECRET);
		urlParams.append('code', code);

		const tokens$ = this._httpService.post(GITHUB_ACCESS_TOKEN_URL, urlParams, {
			headers: {
				'accept': 'application/json'
			}
		}).pipe(
			filter(({ data }) => !!data.error),
			switchMap(({ data }) => this._commandBus.execute(
				new IntegrationTenantCreateCommand({
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
					]
				})
			)),
			catchError((err) => {
				throw new BadRequestException(err);
			})
		);
		return await lastValueFrom(tokens$);
	}
}
