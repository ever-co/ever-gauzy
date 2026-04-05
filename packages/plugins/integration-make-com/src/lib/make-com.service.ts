import { Injectable, Logger, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import {
	IntegrationSettingService,
	IntegrationService,
	IntegrationTenantService,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES,
	IntegrationTenantUpdateOrCreateCommand
} from '@gauzy/core';
import { IIntegrationEntitySetting, IIntegrationTenant, IntegrationEntity, IntegrationEnum } from '@gauzy/contracts';
import {
	IMakeComIntegrationSettings,
	MakeSettingName,
	IIntegrationFilter
} from './interfaces/make-com.model';
import { CommandBus } from '@nestjs/cqrs';

@Injectable()
export class MakeComService {
	private readonly logger = new Logger(MakeComService.name);

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly config: ConfigService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationService: IntegrationService
	) {}

	/**
	 * Retrieves Make.com integration settings for the current tenant and organization.
	 *
	 * @param {string} [organizationId] - Optional organization ID to filter by organization level
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the Make.com integration settings.
	 */
	async getIntegrationSettings(organizationId?: string): Promise<IMakeComIntegrationSettings> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Build the where clause with tenant and optional organization filter
			const whereClause: IIntegrationFilter = {
				name: IntegrationEnum.MakeCom,
				tenantId
			};

			// If organizationId is provided, filter by organization level
			if (organizationId) {
				whereClause.organizationId = organizationId;
			}

			// Find the integration for the current tenant and organization
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: whereClause,
				relations: ['settings']
			});

			if (!integrationTenant) {
				return {
					isEnabled: false,
					webhookUrl: null
				};
			}

			// Extract webhook settings from integration settings
			const enabledSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
			);
			const webhookUrlSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.WEBHOOK_URL
			);

			return {
				isEnabled: enabledSetting ? enabledSetting.settingsValue === 'true' : false,
				webhookUrl: webhookUrlSetting ? webhookUrlSetting.settingsValue : null
			};
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				this.logger.error('Error retrieving Make.com integration settings:', error);
				throw error;
			}
		}
	}

	/**
	 * Updates Make.com integration settings for the current tenant and organization.
	 *
	 * @param {Object} input - The settings to update.
	 * @param {boolean} input.isEnabled - Whether the integration is enabled.
	 * @param {string} input.webhookUrl - The webhook URL for Make.com.
	 * @param {string} [organizationId] - Optional organization ID to filter by organization level
	 * @returns {Promise<IMakeComIntegrationSettings>} A promise that resolves to the updated settings.
	 */
	async updateIntegrationSettings(
		input: {
			isEnabled?: boolean;
			webhookUrl?: string;
		},
		organizationId?: string
	): Promise<IMakeComIntegrationSettings> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Build the where clause with tenant and optional organization filter
			const whereClause: any = {
				name: IntegrationEnum.MakeCom,
				tenantId
			};

			// If organizationId is provided, filter by organization level
			if (organizationId) {
				whereClause.organizationId = organizationId;
			}

			// Find the integration for the current tenant and organization
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: whereClause,
				relations: ['settings']
			});

			if (!integrationTenant) {
				throw new NotFoundException(
					`${IntegrationEnum.MakeCom} integration not found for this tenant${
						organizationId ? ' and organization' : ''
					}`
				);
			}

			const updates = [];

			// Update isEnabled setting if provided
			if (input.isEnabled !== undefined) {
				let enabledSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.IS_ENABLED
				);
				if (enabledSetting) {
					enabledSetting.settingsValue = input.isEnabled.toString();
				} else {
					enabledSetting = {
						settingsName: MakeSettingName.IS_ENABLED,
						settingsValue: input.isEnabled.toString(),
						integration: integrationTenant
					};
				}
				updates.push(this.integrationSettingService.save(enabledSetting));
			}

			// Update webhookUrl setting if provided
			if (input.webhookUrl !== undefined) {
				let webhookUrlSetting = integrationTenant.settings.find(
					(setting) => setting.settingsName === MakeSettingName.WEBHOOK_URL
				);
				if (webhookUrlSetting) {
					webhookUrlSetting.settingsValue = input.webhookUrl;
				} else {
					webhookUrlSetting = {
						settingsName: MakeSettingName.WEBHOOK_URL,
						settingsValue: input.webhookUrl,
						integration: integrationTenant
					};
				}
				updates.push(this.integrationSettingService.save(webhookUrlSetting));
			}

			// Wait for all updates to complete
			await Promise.all(updates);

			// Return the updated settings with organization context
			return this.getIntegrationSettings(organizationId);
		} catch (error) {
			this.logger.error('Error updating Make.com integration settings:', error);
			throw error;
		}
	}

	/**
	 * Add Make.com integration settings for the current tenant and organization.
	 * Client credentials (client_id, client_secret) are read from server-side
	 * environment variables and are never exposed to tenants.
	 *
	 * @param {string} [organizationId] - Optional organization ID for organization-level integration
	 * @returns The created integration tenant.
	 */
	async addIntegrationSettings(organizationId?: string): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId();

			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Validate that server-side OAuth credentials are configured (do NOT persist them to tenant)
			const makeComConfig = this.config?.get('makeCom');
			if (!makeComConfig?.clientId || !makeComConfig?.clientSecret) {
				throw new InternalServerErrorException('Make.com OAuth credentials are not configured on the server. Please set GAUZY_MAKE_CLIENT_ID and GAUZY_MAKE_CLIENT_SECRET environment variables.');
			}

			// Find or create the base integration
			let integration = await this.integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.MakeCom }
			});
			if (!integration) {
				integration = await this.integrationService.create({
					name: IntegrationEnum.MakeCom,
					provider: IntegrationEnum.MakeCom
				});
			}

			// Map project-tied entities with organization and tenant IDs.
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

			return await this._commandBus.execute(
				new IntegrationTenantUpdateOrCreateCommand(
					{
						name: IntegrationEnum.MakeCom,
						integration: { provider: IntegrationEnum.MakeCom },
						tenantId,
						organizationId
					},
					{
						name: IntegrationEnum.MakeCom,
						integration,
						organizationId,
						tenantId,
						entitySettings: entitySettings,
						settings: [
							{
								// Automatically enable the integration when it's created
								settingsName: MakeSettingName.IS_ENABLED,
								settingsValue: 'true'
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
			this.logger.error('Error adding Make.com integration settings:', error);
			throw error;
		}
	}
	/**
	 * Retrieves the OAuth client ID for the Make.com integration from server-side config.
	 *
	 * @returns {Promise<string | null>} A promise that resolves to the OAuth client ID or null if not configured.
	 */
	async getOAuthClientId(): Promise<string | null> {
		const makeComConfig = this.config?.get('makeCom');
		return makeComConfig?.clientId ?? null;
	}
}
