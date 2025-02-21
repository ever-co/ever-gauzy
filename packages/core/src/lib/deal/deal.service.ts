import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { Deal } from './deal.entity';
import { TypeOrmDealRepository } from './repository/type-orm-deal.repository';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

@Injectable()
export class DealService extends TenantAwareCrudService<Deal> {
	constructor(
		readonly typeOrmDealRepository: TypeOrmDealRepository,
		readonly mikroOrmDealRepository: MikroOrmDealRepository
	) {
		super(typeOrmDealRepository, mikroOrmDealRepository);
	}

	/**
	 * Creates a new deal entity.
	 *
	 * This method sets the `createdByUserId` using the current user's ID from the request context,
	 * then calls the create method on the superclass (likely a service or repository) with the modified entity data.
	 *
	 * @param entity - The partial deal entity data to create.
	 * @returns A promise that resolves to the created deal entity.
	 */
	async create(entity: DeepPartial<Deal>): Promise<Deal> {
		try {
			// Call the create method on the superclass with the modified entity data
			return await super.create({
				...entity,
				tenantId: RequestContext.currentTenantId(), // Set the tenant ID
				createdByUserId: RequestContext.currentUserId() // Set the createdByUserId
			});
		} catch (error) {
			// Handle any errors that occur during deal creation
			console.error(`Error occurred while creating deal: ${error.message}`);
			throw new HttpException(`Error occurred while creating deal: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
