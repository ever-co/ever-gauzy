import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeepPartial, FindOneOptions } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
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
	 * Find a Pipeline by ID
	 *
	 * @param id - The ID of the Pipeline to find
	 * @param relations - Optional relations to include in the query
	 * @returns The found Pipeline
	 */
	async findById(id: ID, options?: FindOneOptions<Deal>): Promise<Deal> {
		return await super.findOneByIdString(id, options);
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
			// Set the createdByUserId using the current user's ID from the request context
			entity.createdByUserId = RequestContext.currentUserId();

			// Call the create method on the superclass with the modified entity data
			return await super.create(entity);
		} catch (error) {
			// Handle any errors that occur during deal creation
			console.error(`Error occurred while creating deal: ${error.message}`);
			throw new HttpException(`Error occurred while creating deal: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
