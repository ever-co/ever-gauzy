import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
	IntegrationSettingService,
	IntegrationService,
	IntegrationTenantService,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES,
	IntegrationTenantUpdateOrCreateCommand
} from '@gauzy/core';
import { In } from 'typeorm';
import { IIntegrationEntitySetting, IIntegrationTenant, IntegrationEntity, IntegrationEnum } from '@gauzy/contracts';
import { IMakeComIntegrationSettings, MakeSettingName, IMakeComCreateIntegration, IIntegrationFilter } from './interfaces/make-com.model';
import { CommandBus } from '@nestjs/cqrs';

@Injectable()
export class MakeComService {
	private readonly logger = new Logger(MakeComService.name);

	constructor(
		private readonly _commandBus: CommandBus,
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
			this.logger.error('Error retrieving Make.com integration settings:', error);
			throw error;
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
	 * This method is used to add settings like client ID and client secret.
	 * It is called when the integration is first set up.
	 * The integration is automatically enabled (isEnabled = true) when created.
	 * @param {Object} settings - The settings to add.
	 * @param {string} [organizationId] - Optional organization ID for organization-level integration
	 * @returns The created settings.
	 */
	async addIntegrationSettings(
		settings: IMakeComCreateIntegration,
		organizationId?: string
	): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { client_id, client_secret } = settings;

			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
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
								settingsName: MakeSettingName.CLIENT_ID,
								settingsValue: client_id
							},
							{
								settingsName: MakeSettingName.CLIENT_SECRET,
								settingsValue: client_secret
							},
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
	 * Saves OAuth credentials for the Make.com integration.
	 * This method stores the credentials in the database for persistence across server restarts.
	 *
	 * @param {Object} credentials - The OAuth credentials to save.
	 * @param {string} credentials.clientId - The OAuth client ID.
	 * @param {string} credentials.clientSecret - The OAuth client secret.
	 * @returns {Promise<void>} A promise that resolves when the credentials have been saved.
	 */
	async saveOAuthCredentials(credentials: { clientId: string; clientSecret: string }): Promise<void> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new NotFoundException('Tenant ID not found in request context');
			}

			// Find the integration for the current tenant
			const integrationTenant = await this.integrationTenantService.findOneByWhereOptions({
				name: IntegrationEnum.MakeCom,
				tenantId
			});

			if (!integrationTenant) {
				throw new NotFoundException(`${IntegrationEnum.MakeCom} integration not found for this tenant`);
			}

			// Define the settings to be saved or updated
			const settingsToSave = [
				{
					settingsName: MakeSettingName.CLIENT_ID,
					settingsValue: credentials.clientId,
					integration: integrationTenant
				},
				{
					settingsName: MakeSettingName.CLIENT_SECRET,
					settingsValue: credentials.clientSecret,
					integration: integrationTenant
				}
			];

			// Use the bulkUpdateOrCreate method to save the settings
			await this.integrationSettingService.bulkUpdateOrCreate(integrationTenant.id, settingsToSave);

			this.logger.log(`OAuth credentials updated for tenant: ${tenantId}`);
		} catch (error) {
			this.logger.error('Error saving Make.com OAuth credentials:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the OAuth credentials for the Make.com integration.
	 *
	 * @param {string} integrationId - The ID of the integration to get credentials for.
	 * @returns {Promise<{clientId: string, clientSecret: string}>} A promise that resolves to the OAuth credentials.
	 */
	async getOAuthCredentials(
		integrationId: string,
		organizationId?: string
	): Promise<{ clientId: string; clientSecret: string }> {
		try {
			// Find the integration settings
			const where: any = {
				integration: { id: integrationId },
				settingsName: In([MakeSettingName.CLIENT_ID, MakeSettingName.CLIENT_SECRET])
			};
			if (organizationId) {
				where.organizationId = organizationId;
			}
			const settings = await this.integrationSettingService.find({ where });

			if (!settings || settings.length < 2) {
				throw new NotFoundException(
					'OAuth credentials not found for this integration missing client_id or client_secret'
				);
			}

			// Extract client ID and client secret
			const clientIdSetting = settings.find((setting) => setting.settingsName === MakeSettingName.CLIENT_ID);
			const clientSecretSetting = settings.find(
				(setting) => setting.settingsName === MakeSettingName.CLIENT_SECRET
			);

			if (!clientIdSetting || !clientSecretSetting) {
				throw new NotFoundException('OAuth credentials are incomplete for this integration');
			}

			return {
				clientId: clientIdSetting.settingsValue,
				clientSecret: clientSecretSetting.settingsValue
			};
		} catch (error) {
			this.logger.error('Error retrieving Make.com OAuth credentials:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the OAuth client ID for the Make.com integration.
	 *
	 * @param {string} [organizationId] - Optional organization ID to filter by organization level
	 * @returns {Promise<string>} A promise that resolves to the OAuth client ID or null if not found.
	 */
	async getOAuthClientId(organizationId?: string): Promise<string | null> {
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
				return null;
			}

			// Find the client ID setting
			const clientIdSetting = integrationTenant.settings.find(
				(setting) => setting.settingsName === MakeSettingName.CLIENT_ID
			);

			return clientIdSetting ? clientIdSetting.settingsValue : null;
		} catch (error) {
			this.logger.error('Error retrieving Make.com OAuth client ID:', error);
			throw error;
		}
	}
}
