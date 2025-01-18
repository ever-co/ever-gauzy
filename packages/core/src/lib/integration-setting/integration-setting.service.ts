import { Injectable } from '@nestjs/common';
import { ID, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationSetting } from './integration-setting.entity';
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
