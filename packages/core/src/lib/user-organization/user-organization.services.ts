import { Injectable } from '@nestjs/common';
import { ID, IOrganization, IPagination, IUser, IUserOrganization, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { Employee } from '../core/entities/internal';
import { EmployeeService } from '../employee/employee.service';
import { TypeOrmOrganizationRepository } from '../organization/repository/type-orm-organization.repository';
import { UserOrganization } from './user-organization.entity';
import { TypeOrmUserOrganizationRepository } from './repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {
	constructor(
		readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly employeeService: EmployeeService
	) {
		super(typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository);
	}

	/**
	 * Finds all user organizations based on the provided filter options.
	 *
	 * @param filter Optional filter options to apply when querying user organizations.
	 * @returns A promise resolving to an array of user organizations.
	 */
	async findUserOrganizations(
		filter: BaseQueryDTO<UserOrganization>,
		includeEmployee: boolean
	): Promise<IPagination<UserOrganization>> {
		// Prepare filter with appropriate permissions
		// Ensure we never pass an undefined filter to the helper
		const modifiedFilter = this.applySensitiveRelationsFilter(filter ?? ({} as BaseQueryDTO<UserOrganization>));

		// Execute the query with the potentially modified relations
		let { items, total } = await super.findAll(modifiedFilter);

		// If 'includeEmployee' is set to true, fetch employee details associated with each user organization
		if (includeEmployee) {
			try {
				// Get the tenant ID from the current request context
				const tenantId = RequestContext.currentTenantId();

				// Extract user IDs from the items array
				const userIds =
					items
						.filter((organization: IUserOrganization) => organization?.user) // Filter out user organizations without a user object
						.map((organization: IUserOrganization) => organization?.user?.id) || [];

				// Fetch all employee details in bulk for the extracted user IDs
				const employees = await this.employeeService.findEmployeesByUserIds(userIds, tenantId);

				// Map employee details to a dictionary for easier lookup
				const employeeMap = new Map<string, Employee>();
				employees.forEach((employee: Employee) => {
					// If user ID is available, add employee details to the map
					if (employee.userId) {
						// Add employee details to the map
						employeeMap.set(employee.userId, employee);
					}
				});

				// Merge employee details into each user organization object
				const itemsWithEmployees = items.map((organization: UserOrganization) => {
					// If user ID is available, fetch employee details
					if (organization.userId) {
						// Fetch employee details using the user ID
						const employee = employeeMap.get(organization.userId);
						return { ...organization, user: { ...organization.user, employee } };
					}
					// If user ID is not available, return the original organization object
					return { ...organization };
				});

				// Return paginated result with employee details
				return { items: itemsWithEmployees, total };
			} catch (error) {
				console.error(`Error fetching employee details: ${error.message}`);
			}
		}

		// Return original items if 'includeEmployee' is false
		return { items, total };
	}

	/**
	 * Adds a user to all organizations within a specific tenant.
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, where each element represents the user's association with an organization in the tenant.
	 */
	async addUserToOrganization(user: IUser, organizationId: ID): Promise<IUserOrganization | IUserOrganization[]> {
		/** If role is SUPER_ADMIN, add user to all organizations in the tenant */
		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			return await this._addUserToAllOrganizations(user.id, user.tenantId);
		}

		const entity = new UserOrganization({
			organizationId,
			tenantId: user.tenantId,
			userId: user.id
		});

		return await this.typeOrmUserOrganizationRepository.save(entity);
	}

	/**
	 * Adds a user to all organizations within a given tenant..
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, representing the user-organization relationships created.
	 */
	private async _addUserToAllOrganizations(userId: ID, tenantId: ID): Promise<IUserOrganization[]> {
		/** Add user to all organizations in the tenant */
		const organizations = await this.typeOrmOrganizationRepository.find({
			where: { tenantId }
		});

		const entities = organizations.map(({ id: organizationId }: IOrganization) => {
			const entity = new UserOrganization();
			entity.organizationId = organizationId;
			entity.tenantId = tenantId;
			entity.userId = userId;
			return entity;
		});

		return await this.typeOrmUserOrganizationRepository.save(entities);
	}

	/**
	 * Applies permission-based filtering to relations with fine-grained control over sub-paths.
	 *
	 * @param filter The original filter object from the request
	 * @returns A modified filter with restricted relations based on permissions
	 */
	private applySensitiveRelationsFilter(filter: BaseQueryDTO<UserOrganization>): BaseQueryDTO<UserOrganization> {
		// Deep clone the filter to avoid modifying the original
		const modifiedFilter = JSON.parse(JSON.stringify(filter));

		// Early return if no relations
		if (!modifiedFilter.relations) {
			return modifiedFilter;
		}

		const PERMISSION_CONFIG = {
			organization: {
				_self: null,
				payments: PermissionsEnum.ORG_PAYMENT_VIEW,
				invoices: PermissionsEnum.INVOICES_VIEW,
				invoiceEstimateHistories: PermissionsEnum.INVOICES_VIEW,
				accountingTemplates: PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
				employees: {
					_self: PermissionsEnum.ORG_EMPLOYEES_VIEW,
					user: PermissionsEnum.ORG_USERS_VIEW
				},
				featureOrganizations: PermissionsEnum.ALL_ORG_VIEW,
				contact: PermissionsEnum.ORG_CONTACT_VIEW,
				organizationSprints: PermissionsEnum.ORG_SPRINT_VIEW
			}
		};
		// Filter relations based on complex permission hierarchy
		modifiedFilter.relations = modifiedFilter.relations.filter((relation) => {
			const pathParts = relation.split('.');

			// Start navigation from the root of our permission tree
			let currentPermissionNode = PERMISSION_CONFIG;
			let requiredPermission = null;

			// Navigate through relation path and permission tree together
			for (let i = 0; i < pathParts.length; i++) {
				const pathPart = pathParts[i];

				// If we've reached the end of our defined permission tree, allow access to deeper paths
				if (!currentPermissionNode || typeof currentPermissionNode !== 'object') {
					break;
				}

				// Check if this part of the path is in our permission config
				if (currentPermissionNode[pathPart]) {
					if (typeof currentPermissionNode[pathPart] === 'object') {
						if (currentPermissionNode[pathPart]['_self']) {
							requiredPermission = currentPermissionNode[pathPart]['_self'];
						}
						// Continue navigating deeper
						currentPermissionNode = currentPermissionNode[pathPart];
					} else {
						requiredPermission = currentPermissionNode[pathPart];
						break;
					}
				} else {
					break;
				}
			}

			if (requiredPermission) {
				return RequestContext.hasPermission(requiredPermission);
			}

			return true;
		});

		return modifiedFilter;
	}
}
