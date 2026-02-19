import { Injectable } from '@nestjs/common';
import { FindManyOptions, IsNull, Not } from 'typeorm';
import {
	ID,
	IIntegrationEntitySetting,
	IIntegrationSetting,
	IIntegrationTenant,
	IIntegrationTenantCreateInput,
	IIntegrationTenantFindInput,
	IPagination,
	IntegrationEntity
} from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IntegrationTenant } from './integration-tenant.entity';
import { MikroOrmIntegrationTenantRepository } from './repository/mikro-orm-integration-tenant.repository';
import { TypeOrmIntegrationTenantRepository } from './repository/type-orm-integration-tenant.repository';

@Injectable()
export class IntegrationTenantService extends TenantAwareCrudService<IntegrationTenant> {
	constructor(
		typeOrmIntegrationTenantRepository: TypeOrmIntegrationTenantRepository,
		mikroOrmIntegrationTenantRepository: MikroOrmIntegrationTenantRepository
	) {
		super(typeOrmIntegrationTenantRepository, mikroOrmIntegrationTenantRepository);
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
			where: whereConditions
		});
	}

	/**
	 * Create a new integration tenant with the provided input.
	 *
	 * @param input The data for creating the integration tenant.
	 * @returns A promise that resolves to the created integration tenant.
	 */
	async create(input: IIntegrationTenantCreateInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const { organizationId } = input;

		const settings = (input.settings || []).map((item: IIntegrationSetting) => ({
			...item,
			tenantId,
			organizationId
		}));

		const entitySettings = (input.entitySettings || []).map((item: IIntegrationEntitySetting) => ({
			...item,
			tenantId,
			organizationId
		}));

		return await super.create({
			...input,
			settings,
			entitySettings,
			tenantId,
			organizationId
		});
	}

	/**
	 * Retrieve an integration tenant by specified options.
	 * @param input - The input options for finding the integration tenant.
	 * @returns The integration tenant if found, or `false` if not found or an error occurs.
	 */
	public async getIntegrationByOptions(input: IIntegrationTenantFindInput): Promise<IIntegrationTenant | boolean> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const { organizationId, name } = input;

			const integration = await super.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					isActive: true,
					isArchived: false,
					integration: {
						provider: name,
						isActive: true,
						isArchived: false
					}
				},
				order: { updatedAt: 'DESC' },
				relations: typeof input.relations === 'string' ? [input.relations] : input.relations
			});

			return integration || false;
		} catch (error) {
			console.error('Error occurred while retrieving integration tenant settings:', error?.message);
			return false;
		}
	}

	/**
	 * Get integration tenant settings by specified options.
	 * @param input - The input options for finding the integration tenant settings.
	 * @returns The integration tenant settings if found. null if not found or an error occurs.
	 */
	async getIntegrationTenantSettings(input: IIntegrationTenantFindInput): Promise<IIntegrationTenant | null> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const { organizationId, name } = input;

			return await super.findOneByOptions({
				where: {
					tenantId,
					organizationId,
					name,
					isActive: true,
					isArchived: false,
					integration: {
						provider: name,
						isActive: true,
						isArchived: false
					}
				},
				relations: {
					settings: true
				}
			});
		} catch (error) {
			console.error('Error occurred while retrieving integration tenant settings:', error?.message);
			return null;
		}
	}

	/**
	 * Find an IntegrationTenant by entity type.
	 *
	 * @param param0 - Destructured parameters object.
	 *   @param organizationId - The ID of the organization.
	 *   @param integrationId - The ID of the integration.
	 *   @param entityType - The entity type for which to find the IntegrationTenant.
	 * @returns A promise that resolves to the found IntegrationTenant or null if not found.
	 */
	public async findIntegrationTenantByEntity({
		organizationId,
		integrationId,
		entityType
	}: {
		organizationId: ID;
		integrationId: ID;
		entityType: IntegrationEntity;
	}): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();

		return await super.findOneByOptions({
			where: {
				tenantId,
				organizationId,
				integrationId,
				isActive: true,
				isArchived: false,
				entitySettings: {
					entity: entityType,
					organizationId,
					sync: true,
					isActive: true,
					isArchived: false
				}
			}
		});
	}
}
