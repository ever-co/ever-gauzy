import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In } from 'typeorm';
import { BaseEntityEnum, ID, IFavorite, IFavoriteCreateInput, IPagination, RolesEnum } from '@gauzy/contracts';
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
			const { entity: entityName, entityId, organizationId } = entity;

			// Always prioritize employeeId from RequestContext, fallback to the value from the body if not present in context
			const employeeId = RequestContext.currentEmployeeId() || entity.employeeId;

			// Validation: If no employeeId, only admin or super admin can proceed
			if (!employeeId && !this.hasAdminRole()) {
				throw new BadRequestException(
					'Only admins can create a favorite at the organization level (without an employeeId).'
				);
			}

			// Validate employee existence only if employeeId is present
			if (employeeId) {
				const employee = await this.employeeService.findOneByIdString(employeeId);
				if (!employee) {
					throw new NotFoundException('Employee not found');
				}
			}

			// Check for existing favorite with the same parameters
			const findOptions: FindOptionsWhere<Favorite> = {
				tenantId,
				organizationId,
				employeeId,
				entity: entityName,
				entityId
			};

			let favorite = await this.typeOrmRepository.findOneBy(findOptions);
			if (!favorite) {
				favorite = new Favorite({ ...entity, employeeId });
			}

			// Create or return the existing favorite
			return await this.save(favorite);
		} catch (error) {
			console.error('Error while creating favorite:', error);
			throw new BadRequestException(`Favorite creation failed: ${error?.message || error}`);
		}
	}

	/**
	 * Checks if the current user has an admin or super admin role
	 */
	private hasAdminRole(): boolean {
		return RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);
	}

	/**
	 * @description Delete element from favorites for current employee
	 * @param {ID} id - The favorite ID to be deleted
	 * @returns  A promise that resolved at the deleteResult
	 * @memberof FavoriteService
	 */
	async delete(id: ID): Promise<DeleteResult> {
		try {
			if (!this.hasAdminRole()) {
				const employeeId = RequestContext.currentEmployeeId();
				return await super.delete(id, {
					where: { employeeId }
				});
			}
			// Even admins should respect tenant boundaries unless they're SUPER_ADMIN
			const deleteOptions = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])
				? {}
				: { where: { tenantId: RequestContext.currentTenantId() } };
			return await super.delete(id, deleteOptions);
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

			// return found records for specific service
			return items;
		} catch (error) {
			console.error('Error while retrieving favorite details:', error);
			throw new BadRequestException(error);
		}
	}
}
