import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IIntegrationEntitySetting,
	IIntegrationSetting,
	IIntegrationTenant,
	IIntegrationTenantFindInput,
	IntegrationEnum
} from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
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
		try {
			const { organizationId } = input;
			let { entitySettings = [], settings = [] } = input;

			settings = settings.map((item: IIntegrationSetting) => ({
				...item,
				tenantId,
				organizationId
			}));

			entitySettings = entitySettings.map((item: IIntegrationEntitySetting) => ({
				...item,
				tenantId,
				organizationId
			}));

			return await super.create({
				...input,
				tenantId,
				settings,
				entitySettings
			});
		} catch (error) {
			console.log('Error while creating integration tenant:', tenantId, error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Check integration remember state.
	 *
	 * @param options - The options for checking integration remember state.
	 * @returns The integration tenant if found, or `false` if not found or an error occurred.
	 */
	public async checkIntegrationRememberState(input: IIntegrationTenantFindInput): Promise<IIntegrationTenant | boolean> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { organizationId, name } = input;

			return await this.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					name
				},
				order: {
					updatedAt: 'DESC'
				}
			});
		} catch (error) {
			console.log('Error while getting integration tenant: %s', error?.message);
			return false;
		}
	}

	/**
	 *
	 * @param options
	 * @returns
	 */
	async getIntegrationSettings(
		options: IBasePerTenantAndOrganizationEntityModel
	): Promise<IIntegrationTenant> {
		try {
			const { organizationId, tenantId } = options;
			return await this.findOneByOptions({
				where: {
					organizationId,
					tenantId,
					name: IntegrationEnum.GAUZY_AI
				},
				relations: {
					settings: true
				}
			});
		} catch (error) {
			console.log('Error while getting AI integration settings: %s', error?.message);
		}
	}
}
