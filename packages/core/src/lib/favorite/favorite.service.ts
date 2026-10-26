import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In, IsNull } from 'typeorm';
import {
	BaseEntityEnum,
	ID,
	IFavorite,
	IFavoriteCreateInput,
	IPagination,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Favorite } from './favorite.entity';
import { TypeOrmFavoriteRepository } from './repository/type-orm-favorite.repository';
import { MikroOrmFavoriteRepository } from './repository/mikro-orm-favorite.repository';
import { EmployeeService } from '../employee/employee.service';
import { GlobalFavoriteDiscoveryService } from './global-favorite-service.service';

/**
 * How the details of a favorited record are read (GET /favorite/type has no entity-view permission of its own).
 *
 * - `relations`: what gives the record its display name in the sidebar (an employee's user, an invoice's
 *   client…), joined only for a caller holding `relationsPermission` when one is set; others get the
 *   record without them.
 * - `access`: the permissions (any one) a caller needs to receive the record AT ALL — set for the types that
 *   carry business data of their own (amounts, clients, prices). A favorite is created from an id alone,
 *   so without this a caller could read such a record through the favorites list without being allowed to
 *   open it. Each mirrors the view permission of the type's own read route; a function when it depends on
 *   the row (an estimate is an invoice row read with `ESTIMATES_VIEW`).
 */
export interface IFavoriteDetailOptions {
	relations?: string[];
	relationsPermission?: PermissionsEnum;
	access?: (record: Record<string, unknown>) => PermissionsEnum[];
}

export const FAVORITE_DETAILS: Partial<Record<BaseEntityEnum, IFavoriteDetailOptions>> = {
	[BaseEntityEnum.Employee]: { relations: ['user'], relationsPermission: PermissionsEnum.ORG_EMPLOYEES_VIEW },
	[BaseEntityEnum.Candidate]: { relations: ['user'], relationsPermission: PermissionsEnum.ORG_CANDIDATES_VIEW },
	[BaseEntityEnum.Invoice]: {
		relations: ['toContact'],
		access: (record) => [record?.['isEstimate'] ? PermissionsEnum.ESTIMATES_VIEW : PermissionsEnum.INVOICES_VIEW]
	},
	[BaseEntityEnum.Expense]: {
		relations: ['vendor', 'category'],
		access: () => [PermissionsEnum.ORG_EXPENSES_VIEW]
	},
	[BaseEntityEnum.Income]: {
		// An income's contact is its `client` relation (`Income.client`), not `organizationContact`.
		relations: ['client'],
		access: () => [PermissionsEnum.ORG_INCOMES_VIEW]
	},
	[BaseEntityEnum.Payment]: {
		relations: ['invoice', 'organizationContact'],
		access: () => [PermissionsEnum.ORG_PAYMENT_VIEW]
	},
	[BaseEntityEnum.Proposal]: { access: () => [PermissionsEnum.ORG_PROPOSALS_VIEW] },
	// The equipment pages admit `ALL_ORG_VIEW` too, and the equipment read itself needs no permission.
	[BaseEntityEnum.Equipment]: { access: () => [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_VIEW] },
	// The inventory page admits `ALL_ORG_VIEW` too, but the item read (`GET /products/local/:langCode/:id`) needs
	// `ORG_INVENTORY_VIEW`, so a favorite without it would open a page that cannot load the item.
	[BaseEntityEnum.Product]: { relations: ['translations'], access: () => [PermissionsEnum.ORG_INVENTORY_VIEW] }
};

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
	 * A favorite is its employee's, or the organization's when an admin creates it without one. Any other caller who
	 * may not act for other employees and has no employee record (a viewer, a candidate) may create none, so the
	 * reads the CRUD base scopes match no row for them, instead of the tenant-wide scope it keeps by default, through
	 * which such a caller listed every employee's favorites (`GET /favorite/employee`, `GET /favorite/type`). An
	 * admin keeps that scope, as {@link create} lets them file organization-level favorites.
	 */
	protected override findConditionsWithoutOwnEmployee(): FindOptionsWhere<Favorite> {
		return this.hasAdminRole() ? super.findConditionsWithoutOwnEmployee() : this.neverMatchingEmployeeCondition();
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

			// Check for existing favorite with the same parameters. An organization-level favorite has
			// NO employee: pin that with IsNull() so the de-duplication matches only organization-level
			// rows and never silently returns some other employee's favorite for the same entity.
			const findOptions: FindOptionsWhere<Favorite> = {
				tenantId,
				organizationId,
				employeeId: employeeId ?? IsNull(),
				entity: entityName,
				entityId
			};

			let favorite: Favorite;
			try {
				favorite = await this.findOneByWhereOptions(findOptions);
			} catch {
				favorite = null;
			}
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
	 * The favorited records of a type with an `access` rule, reduced to the ones the caller holds a read
	 * permission for. The result keeps the shape the type's `findAll` answered with (a page or a list).
	 */
	private readableDetails<T>(found: T, details?: IFavoriteDetailOptions): T {
		if (!details?.access) {
			return found;
		}
		const canRead = (record: Record<string, unknown>) =>
			!!record && RequestContext.hasAnyPermission(details.access(record));
		if (Array.isArray(found)) {
			return found.filter(canRead) as T;
		}
		const page = found as unknown as IPagination<Record<string, unknown>>;
		if (Array.isArray(page?.items)) {
			const items = page.items.filter(canRead);
			return { ...page, items, total: items.length } as T;
		}
		return found;
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
				// "Current employee" means the caller's OWN employee record. RequestContext.currentEmployeeId()
				// is deliberately null for CHANGE_SELECTED_EMPLOYEE holders (e.g. managers), which used to
				// drop the employee predicate and let them delete anyone's favorite by id — and would now
				// (null -> IS NULL) stop them deleting even their own. Read the identity off the JWT user
				// instead, and fail closed when the caller has no employee identity at all.
				const employeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
				if (!employeeId) {
					throw new ForbiddenException('Only the owning employee (or an admin) can delete a favorite.');
				}
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
			if (error instanceof ForbiddenException) {
				throw error;
			}
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

			// Some types carry no name of their own (an employee's lives on the linked user, an invoice is named
			// after its number and client): join what names them, for callers allowed to see it.
			const details = FAVORITE_DETAILS[favoriteType];
			const relations =
				details?.relations &&
				(!details.relationsPermission || RequestContext.hasPermission(details.relationsPermission))
					? details.relations
					: undefined;

			// Get related favorite records using findAll method and passing query params
			// Ask for every favorited record: a type whose `findAll` paginates (proposals do) would otherwise
			// answer with its default first page and silently drop the rest from the sidebar.
			const items = await this.favoriteDiscoveryService.callMethod(favoriteType, 'findAll', {
				where: whereCondition,
				take: Math.max(new Set(entityIds).size, 1),
				skip: 0,
				...(relations && { relations })
			});

			// return found records for specific service, without the ones the caller may not read
			return this.readableDetails(items, details);
		} catch (error) {
			console.error('Error while retrieving favorite details:', error);
			throw new BadRequestException(error);
		}
	}
}
