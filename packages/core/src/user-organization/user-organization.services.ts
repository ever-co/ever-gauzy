import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganization, IPagination, ITenant, IUser, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { Employee, Organization } from './../core/entities/internal';
import { TypeOrmOrganizationRepository } from '../organization/repository';
import { UserOrganization } from './user-organization.entity';
import { MikroOrmUserOrganizationRepository, TypeOrmUserOrganizationRepository } from './repository';
import { EmployeeService } from '../employee/employee.service';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {
	constructor(
		@InjectRepository(UserOrganization) readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		@InjectRepository(Organization) readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		private readonly employeeService: EmployeeService,
	) {
		super(typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository);
	}

	/**
	 * Finds all user organizations based on the provided filter options.
	 *
	 * @param filter Optional filter options to apply when querying user organizations.
	 * @returns A promise resolving to an array of user organizations.
	 */
	async findAllUserOrganizations(
		filter: PaginationParams<UserOrganization>,
		includeEmployee: boolean
	): Promise<IPagination<UserOrganization>> {
		// Call the base class method to find all user organizations
		const { items, total } = await super.findAll(filter);

		// If 'includeEmployee' is set to true, fetch employee details associated with each user organization
		if (includeEmployee) {
			try {
				// Extract user IDs from the items array
				const userIds = items.map(organization => organization.user.id);

				// Fetch all employee details in bulk for the extracted user IDs
				const employees = await this.employeeService.findEmployeesByUserIds(userIds);

				// Map employee details to a dictionary for easier lookup
				const employeeMap = new Map<string, Employee>();
				employees.forEach((employee) => {
					employeeMap.set(employee.userId, employee);
				});

				// Merge employee details into each user organization object
				const itemsWithEmployees = items.map(organization => {
					const employee = employeeMap.get(organization.user.id);
					return { ...organization, user: { ...organization.user, employee } };
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
	async addUserToOrganization(
		user: IUser,
		organizationId: IOrganization['id']
	): Promise<IUserOrganization | IUserOrganization[]> {
		/** If role is SUPER_ADMIN, add user to all organizations in the tenant */
		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			return await this._addUserToAllOrganizations(user.id, user.tenantId);
		}

		const entity: IUserOrganization = new UserOrganization();
		entity.organizationId = organizationId;
		entity.tenantId = user.tenantId;
		entity.userId = user.id;
		return await this.typeOrmUserOrganizationRepository.save(entity);
	}

	/**
	 * Adds a user to all organizations within a given tenant..
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, representing the user-organization relationships created.
	 */
	private async _addUserToAllOrganizations(
		userId: IUser['id'],
		tenantId: ITenant['id']
	): Promise<IUserOrganization[]> {
		/** Add user to all organizations in the tenant */
		const organizations = await this.typeOrmOrganizationRepository.find({
			where: { tenantId }
		});

		const entities: IUserOrganization[] = organizations.map((organization: IOrganization) => {
			const entity = new UserOrganization();
			entity.organizationId = organization.id;
			entity.tenantId = tenantId;
			entity.userId = userId;
			return entity;
		});

		return await this.typeOrmUserOrganizationRepository.save(entities);
	}
}
