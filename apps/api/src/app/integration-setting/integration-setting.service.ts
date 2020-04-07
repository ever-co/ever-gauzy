import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationSetting } from './integration-setting.entity';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationSetting } from '@gauzy/models';

@Injectable()
export class IntegrationSettingService extends CrudService<IntegrationSetting> {
	constructor(
		@InjectRepository(IntegrationSetting)
		readonly repository: Repository<IntegrationSetting>
	) {
		super(repository);
	}

	async addIntegrationSettings(integrationSettings: IIntegrationSetting) {
		return await this.create(integrationSettings);
	}

	// setIntegrationSettings(settings: any[]) {
	//     this._repository.find({ where: { tenandId: 'janko' } })
	// }
}
