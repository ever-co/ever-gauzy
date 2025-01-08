import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { TenantApiKey } from './tenant-api-key.entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';

@Injectable()
export class TenantApiKeyService extends TenantAwareCrudService<TenantApiKey> {
	constructor(
		readonly typeOrmTenantApiKeyRepository: TypeOrmTenantApiKeyRepository,
		readonly mikroOrmTenantApiKeyRepository: MikroOrmTenantApiKeyRepository
	) {
		super(typeOrmTenantApiKeyRepository, mikroOrmTenantApiKeyRepository);
	}

	/**
	 * Find a TenantApiKey based on the provided API key.
	 * @param options The FindOptionsWhere object specifying the search criteria.
	 * @returns A Promise that resolves to a TenantApiKey or null if not found.
	 */
	async findApiKeyByOptions(options: FindOptionsWhere<TenantApiKey>): Promise<TenantApiKey | null> {
		try {
			const tenantApiKey = await this.findOneByOptions({
				where: {
					...options,
					isActive: true,
					isArchived: false,
					// Also Filter by Tenant's isActive & isArchived flag
					tenant: {
						isActive: true, // Filter by related Tenant's isActive being true
						isArchived: false // Filter by related Tenant's isArchived being false
					}
				},
				relations: {
					tenant: true // Include the related Tenant entity in the result
				}
			});
			return tenantApiKey || null;
		} catch (error) {
			// Handle any errors that may occur during the database query
			console.error('Error fetching tenant_api_key: %s', error.message);
			return null;
		}
	}
}
