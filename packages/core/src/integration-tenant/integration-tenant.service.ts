import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationTenant } from './integration-tenant.entity';
import { RequestContext } from './../core/context';

@Injectable()
export class IntegrationTenantService extends TenantAwareCrudService<IntegrationTenant> {
	constructor(
		@InjectRepository(IntegrationTenant)
		protected readonly repository: Repository<IntegrationTenant>
	) {
		super(repository);
	}

	async addIntegration(
		input: IIntegrationTenant
	): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, name, entitySettings } = input;

		const settings = input.settings.map((setting) => ({
			...setting,
			tenantId
		}));

		const integration = await this.create({
			tenantId,
			organizationId,
			name,
			settings,
			entitySettings
		});
		return integration;
	}

	async updateIntegration(input) {}
}
