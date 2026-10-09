import { ForbiddenException, Injectable } from '@nestjs/common';
import { ID, IIntegrationSetting, IIntegrationSettingUpdateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationSetting } from './integration-setting.entity';
import { isUserEditableIntegrationSetting } from './integration-setting.utils';
import { TypeOrmIntegrationSettingRepository } from './repository/type-orm-integration-setting.repository';
import { MikroOrmIntegrationSettingRepository } from './repository/mikro-orm-integration-setting.repository';

@Injectable()
export class IntegrationSettingService extends TenantAwareCrudService<IntegrationSetting> {
	constructor(
		readonly typeOrmIntegrationSettingRepository: TypeOrmIntegrationSettingRepository,
		readonly mikroOrmIntegrationSettingRepository: MikroOrmIntegrationSettingRepository
	) {
		super(typeOrmIntegrationSettingRepository, mikroOrmIntegrationSettingRepository);
	}

	/**
	 * Updates the value of a client-editable integration setting (`PUT /integration-setting/:id`).
	 *
	 * - The row is loaded tenant-scoped, so another tenant's id is a 404.
	 * - Only settings on the per-provider allowlist may change; server-managed settings such as
	 *   GitHub's `installation_id` or any OAuth token are refused (GHSA-4rwq-65wh-45h4).
	 * - Only `settingsValue` is written: `settingsName`, `integrationId`, `organizationId` and
	 *   `tenantId` stay as stored, so an update can neither rename a row onto a server-managed key
	 *   nor move it to another integration or organization.
	 *
	 * @param id - The setting row id.
	 * @param input - The new value.
	 * @returns The updated setting.
	 */
	async updateEditableSetting(id: ID, input: IIntegrationSettingUpdateInput): Promise<IIntegrationSetting> {
		const existing = await this.findOneByIdString(id, { relations: { integration: true } });

		if (!isUserEditableIntegrationSetting(existing.integration?.name, existing.settingsName)) {
			throw new ForbiddenException('This integration setting is managed by the server and cannot be changed.');
		}

		await this.create({
			id: existing.id,
			settingsValue: input.settingsValue
		});
		return await this.findOneByIdString(existing.id);
	}

	/**
	 * Bulk update or create integration settings for a specific integration.
	 *
	 * @param integrationId - The identifier of the integration for which settings are updated or created.
	 * @param input - An array of integration settings or a single integration setting to update or create.
	 * @returns {Promise<IIntegrationSetting[]>} - A promise that resolves with an array of updated or created integration settings.
	 */
	async bulkUpdateOrCreate(
		integrationId: ID,
		input: IIntegrationSetting | IIntegrationSetting[]
	): Promise<IIntegrationSetting[]> {
		try {
			// Delete existing settings for the given integration
			await this.delete({ integrationId });

			// Prepare an array of settings to be saved
			const settings: IIntegrationSetting[] = Array.isArray(input) ? input : [input];

			// Save the new settings to the database
			return await this.typeOrmIntegrationSettingRepository.save(settings);
		} catch (error) {
			// Handle any errors that occur during the bulk update or create process
			console.error('Bulk update or create of integration settings failed:', error);
		}
	}
}
