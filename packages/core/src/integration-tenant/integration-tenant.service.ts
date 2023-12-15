import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, IsNull, Not, Repository } from 'typeorm';
import {
	IIntegrationEntitySetting,
	IIntegrationSetting,
	IIntegrationTenant,
	IIntegrationTenantCreateInput,
	IIntegrationTenantFindInput,
	IPagination
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
	 * Find and return a paginated list of IntegrationTenant entities.
	 *
	 * @param options - Optional query and pagination options.
	 * @returns A Promise that resolves to a paginated list of IntegrationTenant entities.
	 */
	public async findAll(options?: FindManyOptions<IntegrationTenant>): Promise<IPagination<IntegrationTenant>> {
		// Define where conditions by merging provided options with a condition for non-null integrationId.
		const whereConditions = {
			...options?.where,
			integrationId: Not(IsNull())
		};

		// Call the superclass's findAll method with merged options and where conditions.
		return await super.findAll({
			...options,
			where: whereConditions,
		});
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

			const integration = await this.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					name,
					isActive: true,
					isArchived: false,
					integration: {
						provider: name,
						isActive: true,
						isArchived: false,
					},
				},
				order: { updatedAt: 'DESC' },
				relations: { integration: true },
			});

			return integration || false;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get integration tenant settings by specified options.
	 * @param input - The input options for finding the integration tenant settings.
	 * @returns The integration tenant settings if found.
	 * @throws BadRequestException if not found or an error occurs.
	 */
	async getIntegrationTenantSettings(
		input: IIntegrationTenantFindInput
	): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { organizationId, name } = input;

			return await this.findOneByOptions({
				where: {
					organizationId,
					tenantId,
					name,
					isActive: true,
					isArchived: false,
					integration: {
						provider: name,
						isActive: true,
						isArchived: false,
					}
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
