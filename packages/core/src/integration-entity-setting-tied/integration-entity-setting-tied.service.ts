import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationEntitySettingTied } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied';

@Injectable()
export class IntegrationEntitySettingTiedService extends TenantAwareCrudService<IntegrationEntitySettingTied> {
	constructor(
		@InjectRepository(IntegrationEntitySettingTied)
		readonly repository: Repository<IntegrationEntitySettingTied>
	) {
		super(repository);
	}

	/**
	 * CREATE | UPDATE bulk integration entity setting tied entities by integration
	 * 
	 * @param input 
	 * @returns 
	 */
	 async bulkUpdateOrCreate(
		input: IIntegrationEntitySettingTied | IIntegrationEntitySettingTied[]
	): Promise<IIntegrationEntitySettingTied[]> {
		const settings: IIntegrationEntitySettingTied[] = [];
		if (input instanceof Array) {
			settings.push(...input);
		} else {
			settings.push(input);
		}
		return await this.repository.save(settings);
	}
}
