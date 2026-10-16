import { ForbiddenException, Injectable } from '@nestjs/common';
import { ID, IIntegrationSetting, IIntegrationSettingUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
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
			// Prepare an array of settings to be saved
			const settings: IIntegrationSetting[] = Array.isArray(input) ? input : [input];

			// Delete existing settings for the given integration
			await this.deleteSettingsOf(integrationId, settings);

			// Save the new settings to the database
			return await this.typeOrmIntegrationSettingRepository.save(settings);
		} catch (error) {
			// Handle any errors that occur during the bulk update or create process
			console.error('Bulk update or create of integration settings failed:', error);
		}
	}

	/**
	 * Deletes the stored settings of an integration before they are replaced.
	 *
	 * With a user in context, the tenant-aware delete scopes the statement to the user's tenant. A public OAuth
	 * callback (Make.com's) or a token refresh outside a request has no user, and that delete fails on the
	 * missing user. `bulkUpdateOrCreate` swallowed the failure, so the new tokens were never saved. Without a
	 * user, the statement is bounded by the integration id, which the caller resolved within its tenant, and by
	 * the tenant the settings are written for.
	 *
	 * @param integrationId - The integration whose settings are replaced.
	 * @param settings - The settings about to be saved.
	 */
	private async deleteSettingsOf(integrationId: ID, settings: IIntegrationSetting[]): Promise<void> {
		if (RequestContext.currentUser()) {
			await this.delete({ integrationId });
			return;
		}

		const tenantId = settings.find((setting) => setting?.tenantId)?.tenantId;
		await this.typeOrmIntegrationSettingRepository.delete({ integrationId, ...(tenantId ? { tenantId } : {}) });
	}
}
