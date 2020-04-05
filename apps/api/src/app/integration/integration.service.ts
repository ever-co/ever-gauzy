import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Integration } from './integration.entity';
import { TenantService } from '../tenant';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IIntegration } from '@gauzy/models';

@Injectable()
export class IntegrationService extends CrudService<Integration> {
	constructor(
		@InjectRepository(Integration)
		readonly repository: Repository<Integration>,
		private _tenantService: TenantService,
		private _integrationSettingService: IntegrationSettingService
	) {
		super(repository);
	}

	async addIntegration(createIntegrationDto): Promise<IIntegration> {
		const { record: tenant } = await this._tenantService.findOneOrFail(
			createIntegrationDto.tenantId
		);
		const integration = await this.create({
			tenant,
			name: createIntegrationDto.name
		});
		const settingsDto = createIntegrationDto.settings.map((setting) => ({
			...setting,
			integration
		}));

		await this._integrationSettingService.addIntegrationSettings(
			settingsDto
		);

		return integration;
	}
}
