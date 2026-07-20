import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { HttpService } from '@nestjs/axios';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstValueFrom, switchMap } from 'rxjs';
import { environment } from '@gauzy/config';
import { SyncTags } from '@gauzy/constants';
import {
	GithubPropertyMapEnum,
	IGithubAppInstallInput,
	IIntegrationTenant,
	IOAuthAppInstallInput,
	IntegrationEntity,
	IntegrationEnum
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
		private readonly _integrationService: IntegrationService,
		@InjectDataSource() private readonly _dataSource: DataSource
	) {}

	/**
	 * Rejects binding a GitHub App `installation_id` that is already linked to a DIFFERENT tenant.
	 *
	 * The install endpoint stores the caller-supplied `installation_id` against the caller's own
	 * tenant without proving the caller initiated that installation, so a user could otherwise bind a
	 * victim's `installation_id` to their own tenant and read the victim's repositories (CWE-639,
	 * GHSA-4rwq-65wh-45h4). Enforcing first-claimant-wins uniqueness across tenants removes the
	 * simultaneous multi-tenant-binding window. This query is intentionally NOT tenant-scoped because
	 * it must detect bindings owned by other tenants.
	 *
	 * @param installationId - The GitHub App installation id being bound.
	 * @param tenantId - The caller's tenant id.
	 * @throws BadRequestException if the installation is already linked to another tenant.
	 */
	private async assertInstallationNotClaimedByAnotherTenant(installationId: string, tenantId: string): Promise<void> {
		let repository: ReturnType<DataSource['getRepository']>;
		try {
			repository = this._dataSource.getRepository('IntegrationSetting');
		} catch (error) {
			// The IntegrationSetting entity could not be resolved — a configuration problem, not a
			// runtime/availability one. Do NOT block legitimate installs over a config issue; skip the
			// uniqueness check and log loudly.
			this.logger.error('IntegrationSetting repository unavailable; skipping GitHub uniqueness check', error?.message);
			return;
		}

		let existingBindings: Array<{ tenantId?: string | null }>;
		try {
			existingBindings = (await repository.find({
				where: {
					settingsName: GithubPropertyMapEnum.INSTALLATION_ID,
					settingsValue: installationId
				}
			})) as Array<{ tenantId?: string | null }>;
		} catch (error) {
			// FAIL CLOSED on a lookup (DB) error: this is a security boundary, so a transient failure
			// must not silently allow a potentially cross-tenant binding.
			this.logger.error('GitHub installation uniqueness lookup failed', error?.message);
			throw new HttpException(
				'Unable to verify the GitHub App installation. Please try again.',
				HttpStatus.SERVICE_UNAVAILABLE
			);
		}

		// Reject if the installation is bound to ANY tenant other than the caller's — including rows
		// with a null/empty tenantId (treated as claimed-by-unknown rather than unclaimed).
		const claimedByAnotherTenant = existingBindings.some((setting) => setting.tenantId !== tenantId);
		if (claimedByAnotherTenant) {
			throw new BadRequestException('This GitHub App installation is already linked to another account.');
		}
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

			// Security: reject an installation_id already bound to another tenant (GHSA-4rwq-65wh-45h4).
			await this.assertInstallationNotClaimedByAnotherTenant(installation_id, tenantId);

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
								settingsValue: SyncTags.GITHUB
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
			// Preserve intentional HTTP exceptions (e.g. the cross-tenant uniqueness rejection above).
			if (error instanceof HttpException) {
				throw error;
			}
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
