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
	 * Goes through the tenant-aware `saveMany()`, which stamps the caller's tenant and refuses ids
	 * (and nested tied entities) of another tenant. The raw `repository.save(body)` it replaces upserted
	 * any tenant's setting by the id in the body (GHSA-jh6m-9fxr-rx3c). Every item is pinned to the
	 * integration of the route, which the caller has already been checked against.
	 *
	 * @param integrationId - The integration (from the route) the settings belong to.
	 * @param input - An individual IIntegrationEntitySetting or an array of IIntegrationEntitySetting objects to be created or updated.
	 * @returns A promise resolving to an array of created or updated IIntegrationEntitySetting objects.
	 */
	async bulkUpdateOrCreate(
		integrationId: ID,
		input: IIntegrationEntitySetting | IIntegrationEntitySetting[]
	): Promise<IIntegrationEntitySetting[]> {
		// Prepare an array of settings to be saved
		const settings: IIntegrationEntitySetting[] = (Array.isArray(input) ? input : [input]).map((setting) => {
			// The relation object would take precedence over the pinned integrationId.
			const { integration, ...rest } = setting ?? ({} as IIntegrationEntitySetting);
			return { ...rest, integrationId };
		});

		// Save the new settings to the database
		return await this.saveMany(settings);
	}
}
