import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationEntitySettingTied } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { MikroOrmIntegrationEntitySettingTiedRepository } from './repository/mikro-orm-integration-entity-setting-tied.repository';
import { TypeOrmIntegrationEntitySettingTiedRepository } from './repository/type-orm-integration-entity-setting-tied.repository';

@Injectable()
export class IntegrationEntitySettingTiedService extends TenantAwareCrudService<IntegrationEntitySettingTied> {
	constructor(
		@InjectRepository(IntegrationEntitySettingTied)
		readonly typeOrmIntegrationEntitySettingTiedRepository: TypeOrmIntegrationEntitySettingTiedRepository,

		mikroOrmIntegrationEntitySettingTiedRepository: MikroOrmIntegrationEntitySettingTiedRepository
	) {
		super(typeOrmIntegrationEntitySettingTiedRepository, mikroOrmIntegrationEntitySettingTiedRepository);
	}

	/**
	 * Create or update bulk integration entity settings tied entities by integration.
	 *
	 * @param input - The integration entity setting tied input data, either a single entity or an array of entities.
	 * @returns A promise that resolves to an array of created or updated IIntegrationEntitySettingTied instances.
	 */
	async bulkUpdateOrCreate(
		input: IIntegrationEntitySettingTied | IIntegrationEntitySettingTied[]
	): Promise<IIntegrationEntitySettingTied[]> {
		// Ensure that the input is always an array for consistency
		const settings: IIntegrationEntitySettingTied[] = Array.isArray(input) ? input : [input];

		// Save the array of integration entity settings to the database
		const savedSettings: IIntegrationEntitySettingTied[] = await this.typeOrmIntegrationEntitySettingTiedRepository.save(settings);

		// Return the array of created or updated integration entity settings
		return savedSettings;
	}
}
