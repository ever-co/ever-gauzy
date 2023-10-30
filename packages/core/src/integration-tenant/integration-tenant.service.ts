import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IIntegrationEntitySetting,
	IIntegrationSetting,
	IIntegrationTenant,
	IIntegrationTenantCreateInput,
	IIntegrationTenantFindInput,
	IntegrationEnum
} from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { TenantAwareCrudService } from 'core/crud';
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
	 * Create a new integration tenant with the provided input.
	 * @param input The data for creating the integration tenant.
	 * @returns A promise that resolves to the created integration tenant.
	 */
	async create(
		input: IIntegrationTenantCreateInput
	): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			let { organizationId, entitySettings = [], settings = [] } = input;

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
				organizationId,
				settings,
				entitySettings
			});
		} catch (error) {
			console.log('Error while creating integration tenant:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieve an integration tenant by specified options.
	 * @param input - The input options for finding the integration tenant.
	 * @returns The integration tenant if found, or `false` if not found or an error occurs.
	 */
	public async getIntegrationByOptions(
		input: IIntegrationTenantFindInput
	): Promise<IIntegrationTenant | boolean> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { organizationId, name } = input;

			const integrationTenant = await this.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					name,
					isActive: true,
					isArchived: false,
					integration: {
						isActive: true,
						isArchived: false
					}
				},
				order: {
					updatedAt: 'DESC'
				},
				relations: {
					integration: true
				}
			});
			return integrationTenant || false;
		} catch (error) {
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
			console.log('Error while getting integration settings: %s', error?.message);
			throw new BadRequestException(error?.message);
		}
	}
}
