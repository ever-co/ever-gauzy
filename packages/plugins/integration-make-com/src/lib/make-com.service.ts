import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationSetting, RequestContext } from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';
import { IMakeComIntegrationSettings, MakeSettingName } from './types';

@Injectable()
export class MakeComService {
	private readonly logger = new Logger(MakeComService.name);

	constructor(
		@InjectRepository(IntegrationSetting)
		private readonly integrationSettingRepository: Repository<IntegrationSetting>
	) {}

	/**
	 * Retrieves the Make.com integration settings for a specific tenant.
	 *
	 * @param tenantId - The unique identifier for the tenant.
	 * @param organizationId - Optional organization identifier.
	 * @returns A promise that resolves to an object containing the integration settings.
	 */
	async getIntegrationSettings(organizationId?: ID): Promise<IMakeComIntegrationSettings> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new NotFoundException('Tenant ID not found in request context');
		}

		try {
			// Fetch both settings concurrently
			const [enabledSetting, webhookUrlSetting] = await Promise.all([
				this.findSetting(tenantId, organizationId, MakeSettingName.IS_ENABLED),
				this.findSetting(tenantId, organizationId, MakeSettingName.WEBHOOK_URL)
			]);

			return {
				isEnabled: enabledSetting?.settingsValue === 'true',
				webhookUrl: webhookUrlSetting?.settingsValue ?? null
			};
		} catch (error) {
			this.logger.warn(`Failed to get Make.com settings: ${error.message}`);
			// Return default values if settings not found
			return {
				isEnabled: false,
				webhookUrl: null
			};
		}
	}

	/**
	 * Update Make.com integration settings for a tenant.
	 *
	 * @param input - The DTO containing the updated settings.
	 * @param organizationId - Optional organization identifier.
	 * @returns A promise that resolves to an object containing the updated settings.
	 */
	async updateIntegrationSettings(
		input: UpdateMakeComSettingsDTO,
		organizationId?: ID
	): Promise<IMakeComIntegrationSettings> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new NotFoundException('Tenant ID not found in request context');
		}

		const webhookUrl = input.webhookUrl ?? null;
		const isEnabled = input.isEnabled;

		// Update both settings concurrently
		await Promise.all([
			this.upsertSetting(tenantId, organizationId, MakeSettingName.IS_ENABLED, isEnabled.toString()),
			this.upsertSetting(tenantId, organizationId, MakeSettingName.WEBHOOK_URL, webhookUrl)
		]);

		return {
			isEnabled: input.isEnabled,
			webhookUrl
		};
	}

	/**
	 * Find a setting by tenant, organization, and name
	 *
	 * @param tenantId - The unique identifier for the tenant.
	 * @param organizationId - The identifier for the organization or null.
	 * @param settingsName - The name of the setting to find.
	 * @returns A promise that resolves to an IntegrationSetting or null if not found.
	 */
	private async findSetting(
		tenantId: ID,
		organizationId: ID | null,
		settingsName: MakeSettingName
	): Promise<IntegrationSetting | null> {
		// Construct a typed query object
		const query: Partial<IntegrationSetting> = { tenantId, settingsName };

		if (organizationId) {
			query.organizationId = organizationId;
		}

		return this.integrationSettingRepository.findOne({ where: query });
	}

	/**
	 * Upsert a Make.com integration setting for a tenant.
	 *
	 * If the setting exists, its value is updated. If it does not exist, a new setting is created.
	 *
	 * @param tenantId - The unique identifier for the tenant.
	 * @param organizationId - The unique identifier for the organization (optional).
	 * @param settingsName - The name of the setting to update or create.
	 * @param settingsValue - The new value for the setting.
	 * @returns A promise that resolves to the updated or created IntegrationSetting.
	 */
	private async upsertSetting(
		tenantId: ID,
		organizationId: ID | null,
		settingsName: MakeSettingName,
		settingsValue: string
	): Promise<IntegrationSetting> {
		let setting = await this.findSetting(tenantId, organizationId, settingsName);

		if (setting) {
			// Update the existing setting value
			setting.settingsValue = settingsValue;
		} else {
			// Create a new setting with the provided values
			setting = this.integrationSettingRepository.create({
				tenantId,
				organizationId: organizationId ?? null,
				settingsName,
				settingsValue
			});
		}

		return this.integrationSettingRepository.save(setting);
	}
}
