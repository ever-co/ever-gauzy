import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationEntitySetting, IIntegrationTenant, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';

@Injectable()
export class IntegrationEntitySettingService extends TenantAwareCrudService<IntegrationEntitySetting> {
	constructor(
		@InjectRepository(IntegrationEntitySetting)
		integrationRepository: Repository<IntegrationEntitySetting>
	) {
		super(integrationRepository);
	}

	/**
	 * Get integration entity settings by integration ID.
	 *
	 * @param integrationId - The ID of the integration.
	 * @returns A promise resolving to an array of integration entity settings.
	 */
	async getIntegrationEntitySettings(
		integrationId: IIntegrationTenant['id']
	): Promise<IPagination<IntegrationEntitySetting>> {
		return await this.findAll({
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
		const settings = Array.isArray(input) ? input : [input];
		return await this.repository.save(settings);
	}
}
