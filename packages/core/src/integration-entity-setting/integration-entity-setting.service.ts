import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationEntitySetting } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';

@Injectable()
export class IntegrationEntitySettingService extends TenantAwareCrudService<IntegrationEntitySetting> {
	constructor(
		@InjectRepository(IntegrationEntitySetting)
		readonly repository: Repository<IntegrationEntitySetting>
	) {
		super(repository);
	}

	/**
	 * GET integration entity settings by integration
	 * 
	 * @param integrationId 
	 * @returns 
	 */
	async getIntegrationEntitySettings(
		integrationId: string
	) {
		return await this.findAll({
			relations: ['integration', 'tiedEntities'],
			where: {
				integration: { id: integrationId }
			}
		});
	}

	/**
	 * CREATE | UPDATE bulk integration entity setting by integration
	 * 
	 * @param input 
	 * @returns 
	 */
	async bulkUpdateOrCreate(
		input: IIntegrationEntitySetting | IIntegrationEntitySetting[]
	): Promise<IIntegrationEntitySetting[]> {
		const settings: IIntegrationEntitySetting[] = [];
		if (input instanceof Array) {
			settings.push(...input);
		} else {
			settings.push(input);
		}
		return await this.repository.save(settings);
	}
}
