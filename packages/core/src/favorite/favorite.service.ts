import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { FavoriteTypeEnum, ID, IFavorite, IFavoriteCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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
	 * @param {FavoriteTypeEnum} favoritableType - Favoritable service identifier
	 * @returns A promise resolved at favorites elements records
	 * @memberof FavoriteService
	 */
	async getFavoriteDetails(favoritableType: FavoriteTypeEnum) {
		try {
			const serviceWithMethods = this.favoriteDiscoveryService.getService(favoritableType);

			if (!serviceWithMethods) {
				throw new BadRequestException(`Service for entity of type ${favoritableType} not found.`);
			}

			const items = this.favoriteDiscoveryService.callMethod(favoritableType, 'findAll');
			console.log(items);
			return items;
		} catch (error) {
			throw new InternalServerErrorException(error);
		}
	}
}
