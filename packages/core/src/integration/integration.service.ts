import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Integration } from './integration.entity';
import { RequestContext } from '../core/context';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { TenantService } from '../tenant/tenant.service';
import { IntegrationEnum } from '@gauzy/contracts';

@Injectable()
export class IntegrationService extends CrudService<Integration> {
	constructor(
		@InjectRepository(Integration)
		readonly repository: Repository<Integration>,

		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _tenantService: TenantService
	) {
		super(repository);
	}

	/*
	 * Check upwork remember state for logged in user
	 */
	public async checkIntegrationRememberState(
		integration: IntegrationEnum,
		organizationId: string
	) {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { record: tenant } = await this._tenantService.findOneOrFailByIdString(
				tenantId
			);

			return await this._integrationTenantService.findOneOrFailByOptions({
				where: {
					tenant,
					organizationId,
					name: integration
				},
				order: {
					updatedAt: 'DESC'
				}
			});

		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
