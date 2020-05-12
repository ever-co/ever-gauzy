import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationTenant } from './integration-tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IIntegrationTenant } from '@gauzy/models';

@Injectable()
export class IntegrationTenantService extends CrudService<IntegrationTenant> {
	constructor(
		@InjectRepository(IntegrationTenant)
		readonly repository: Repository<IntegrationTenant>,
		private _tenantService: TenantService,
		private _integrationSettingService: IntegrationSettingService
	) {
		super(repository);
	}

	async addIntegration(createIntegrationDto): Promise<IIntegrationTenant> {
		const { record: tenant } = await this._tenantService.findOneOrFail(
			createIntegrationDto.tenantId
		);
		const integration = await this.create({
			tenant,
			name: createIntegrationDto.name,
			entitySettings: createIntegrationDto.entitySettings
		});
		const settingsDto = createIntegrationDto.settings.map((setting) => ({
			...setting,
			integration
		}));

		await this._integrationSettingService.create(settingsDto);

		return integration;
	}

	async updateIntegration(updateIntegrationDto) {}
}
