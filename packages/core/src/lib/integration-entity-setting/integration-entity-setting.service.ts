import { Injectable } from '@nestjs/common';
import { ID, IIntegrationEntitySetting, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { MikroOrmIntegrationEntitySettingRepository } from './repository/mikro-orm-integration-entity-setting.repository';
import { TypeOrmIntegrationEntitySettingRepository } from './repository/type-orm-integration-entity-setting.repository';

@Injectable()
export class IntegrationEntitySettingService extends TenantAwareCrudService<IntegrationEntitySetting> {
	constructor(
		readonly typeOrmIntegrationEntitySettingRepository: TypeOrmIntegrationEntitySettingRepository,
		readonly mikroOrmIntegrationEntitySettingRepository: MikroOrmIntegrationEntitySettingRepository
	) {
		super(typeOrmIntegrationEntitySettingRepository, mikroOrmIntegrationEntitySettingRepository);
	}

	/**
	 * Get integration entity settings by integration ID.
	 *
	 * @param integrationId - The ID of the integration.
	 * @returns A promise resolving to an array of integration entity settings.
	 */
	async getIntegrationEntitySettings(integrationId: ID): Promise<IPagination<IntegrationEntitySetting>> {
		return await super.findAll({
			where: {
				integrationId
			},
			relations: {
				integration: true,
				tiedEntities: true
			}
		});
	}

	/**
	 * Create or update integration entity settings in bulk by integration.
	 *
	 * @param input - An individual IIntegrationEntitySetting or an array of IIntegrationEntitySetting objects to be created or updated.
	 * @returns A promise resolving to an array of created or updated IIntegrationEntitySetting objects.
	 */
	async bulkUpdateOrCreate(
		input: IIntegrationEntitySetting | IIntegrationEntitySetting[]
	): Promise<IIntegrationEntitySetting[]> {
		// Prepare an array of settings to be saved
		const settings: IIntegrationEntitySetting[] = Array.isArray(input) ? input : [input];

		// Save the new settings to the database
		return await this.typeOrmIntegrationEntitySettingRepository.save(settings);
	}
}
