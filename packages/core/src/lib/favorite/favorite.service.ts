import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In } from 'typeorm';
import { BaseEntityEnum, ID, IFavorite, IFavoriteCreateInput, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
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
	 * @description Find favorites by employee
	 * @param {BaseQueryDTO<Favorite>} options Filter criteria to find favorites
	 * @returns A promise that resolves to paginated list of favorites
	 * @memberof FavoriteService
	 */
	async findFavoritesByEmployee(options: BaseQueryDTO<Favorite>): Promise<IPagination<IFavorite>> {
		try {
			const { where, relations = [], take, skip } = options;

			const employeeId = RequestContext.currentEmployeeId() || where.employeeId;

			return await super.findAll({
				where: { ...where, employeeId },
				...(skip && { skip }),
				...(take && { take }),
				...(relations && { relations })
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
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
			const { employeeId, entity: entityName, entityId, organizationId } = entity;

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
				entity: entityName,
				entityId
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
	async getFavoriteDetails(options?: BaseQueryDTO<Favorite>) {
		try {
			const { where } = options;
			const { entity } = where;
			const favoriteType: BaseEntityEnum = entity as BaseEntityEnum;

			// Find favorite elements with filtered params
			const favorites = await super.findAll(options);

			// Get related entity IDs
			const entityIds: ID[] = favorites.items.map((favorite) => favorite.entityId);

			// Get current requested service
			const serviceWithMethods = this.favoriteDiscoveryService.getService(favoriteType);

			if (!serviceWithMethods) {
				throw new BadRequestException(`Service for entity of type ${entity} not found.`);
			}

			// related entity where condition (Filtered records with passed IDs)
			const whereCondition = { id: In(entityIds) };

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
