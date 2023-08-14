import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IBaseRelationsEntityModel, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { IntegrationTenant } from './integration-tenant.entity';

@Injectable()
export class IntegrationTenantService extends TenantAwareCrudService<IntegrationTenant> {
	constructor(
		@InjectRepository(IntegrationTenant)
		protected readonly repository: Repository<IntegrationTenant>
	) {
		super(repository);
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async create(
		input: IIntegrationTenant
	): Promise<IIntegrationTenant> {

		const tenantId = RequestContext.currentTenantId();
		const { organizationId, name, entitySettings = [], settings = [] } = input;

		settings.map((setting: IIntegrationSetting) => ({
			...setting,
			tenantId
		}));

		return await super.create({
			tenantId,
			organizationId,
			name,
			settings,
			entitySettings
		});
	}

	/*
	 * Check upwork remember state for logged in user
	 */
	public async checkIntegrationRememberState(options: IIntegrationTenant): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { organizationId, name } = options;

			return await this.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					name
				},
				order: {
					updatedAt: 'DESC'
				},
				relations: {
					settings: true
				}
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
