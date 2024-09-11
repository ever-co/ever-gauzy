import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In } from 'typeorm';
import { FavoriteTypeEnum, ID, IFavorite, IFavoriteCreateInput } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Favorite } from './favorite.entity';
import { TypeOrmFavoriteRepository } from './repository/type-orm-favorite.repository';
import { MikroOrmFavoriteRepository } from './repository/mikro-orm-favorite.repository';
import { EmployeeService } from '../employee/employee.service';
import { GlobalFavoriteDiscoveryService } from './global-favorite-service.service';

@Injectable()
export class FavoriteService extends TenantAwareCrudService<Favorite> {
	constructor(
		private readonly favoriteDiscoveryService: GlobalFavoriteDiscoveryService,
		readonly typeOrmFavoriteRepository: TypeOrmFavoriteRepository,
		readonly mikroOrmFavoriteRepository: MikroOrmFavoriteRepository,
		private readonly employeeService: EmployeeService
	) {
		super(typeOrmFavoriteRepository, mikroOrmFavoriteRepository);
	}

	/**
	 * @description Mark entity element as favorite
	 * @param {IFavoriteCreateInput} entity - Data to create favorite element
	 * @returns A promise that resolves to the created or found favorite element
	 * @memberof FavoriteService
	 */
	async create(entity: IFavoriteCreateInput): Promise<IFavorite> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, favoritableType, relatedEntityId, organizationId } = entity;

			// Employee existence validation
			const employee = await this.employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException('Employee not found');
			}

			// Check for exiting favorite element
			const findOptions: FindOptionsWhere<Favorite> = {
				tenantId,
				organizationId,
				employeeId,
				favoritableType,
				relatedEntityId
			};

			let favorite = await this.typeOrmRepository.findOneBy(findOptions);
			if (!favorite) {
				favorite = new Favorite(entity);
			}

			// If favorite element not exists, create and return new one
			return await this.save(favorite);
		} catch (error) {
			console.log(error);
			throw new BadRequestException('Favorite creation failed', error);
		}
	}

	/**
	 * @description Delete element from favorites for current employee
	 * @param {ID} id - The favorite ID to be deleted
	 * @returns  A promise that resolved at the deleteResult
	 * @memberof FavoriteService
	 */
	async delete(id: ID): Promise<DeleteResult> {
		try {
			const employeeId = RequestContext.currentEmployeeId();
			return await super.delete(id, {
				where: { employeeId }
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * @description Get favorites elements details
	 * @param options - Favorite query params
	 * @returns A promise resolved at favorites elements records
	 * @memberof FavoriteService
	 */
	async getFavoriteDetails(options?: PaginationParams<Favorite>) {
		try {
			const { where } = options;
			const { favoritableType } = where;
			const favoriteType: FavoriteTypeEnum = favoritableType as FavoriteTypeEnum;

			// Find favorite elements with filtered params
			const favorites = await this.findAll(options);

			// Get related entity IDs
			const relatedEntityIds: ID[] = favorites.items.map((favorite) => favorite.relatedEntityId);

			// Get current requested service
			const serviceWithMethods = this.favoriteDiscoveryService.getService(favoriteType);

			if (!serviceWithMethods) {
				throw new BadRequestException(`Service for entity of type ${favoritableType} not found.`);
			}

			// related entity where condition (Filtered records with passed IDs)
			const whereCondition = { id: In(relatedEntityIds) };

			// Get related favorite records using findAll method and passing query params
			const items = await this.favoriteDiscoveryService.callMethod(favoriteType, 'findAll', {
				where: whereCondition
			});

			// return founded records for specific service
			return items;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException(error);
		}
	}
}
