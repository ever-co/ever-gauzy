import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Integration } from './integration.entity';
import { RequestContext } from '../core/context';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { TenantService } from '../tenant/tenant.service';
import { IntegrationEnum } from '@gauzy/models';

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
	public async checkIntegrationRemeberState(
		integration: IntegrationEnum,
		organizationId: string
	) {
		try {
			const user = RequestContext.currentUser();
			const { tenantId } = user;
			const { record: tenant } = await this._tenantService.findOneOrFail(
				tenantId
			);
			return await this._integrationTenantService.findOneOrFail({
				where: {
					tenant: tenant,
					name: integration,
					organizationId
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
