import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	ActionTypeEnum,
	ActivityLogEntityEnum,
	ActorTypeEnum,
	FavoriteEntityEnum,
	IOrganizationSprint,
	IOrganizationSprintCreateInput,
	RolesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationSprintEmployee } from '../core/entities/internal';
import { FavoriteService } from '../core/decorators';
// import { prepareSQLQuery as p } from './../database/database.helper';
import { ActivityLogEvent } from '../activity-log/events';
import { generateActivityLogDescription } from '../activity-log/activity-log.helper';
import { RoleService } from '../role/role.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationSprint } from './organization-sprint.entity';
import { TypeOrmEmployeeRepository } from '../employee/repository';
import {
	MikroOrmOrganizationSprintEmployeeRepository,
	MikroOrmOrganizationSprintRepository,
	TypeOrmOrganizationSprintEmployeeRepository,
	TypeOrmOrganizationSprintRepository
} from './repository';

@FavoriteService(FavoriteEntityEnum.OrganizationSprint)
@Injectable()
export class OrganizationSprintService extends TenantAwareCrudService<OrganizationSprint> {
	constructor(
		readonly typeOrmOrganizationSprintRepository: TypeOrmOrganizationSprintRepository,
		readonly mikroOrmOrganizationSprintRepository: MikroOrmOrganizationSprintRepository,
		readonly typeOrmOrganizationSprintEmployeeRepository: TypeOrmOrganizationSprintEmployeeRepository,
		readonly mikroOrmOrganizationSprintEmployeeRepository: MikroOrmOrganizationSprintEmployeeRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly _roleService: RoleService,
		private readonly _employeeService: EmployeeService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmOrganizationSprintRepository, mikroOrmOrganizationSprintRepository);
	}

	/**
	 * Creates an organization sprint based on the provided input.
	 * @param input - Input data for creating the organization sprint.
	 * @returns A Promise resolving to the created organization sprint.
	 * @throws BadRequestException if there is an error in the creation process.
	 */
	async create(input: IOrganizationSprintCreateInput): Promise<IOrganizationSprint> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const employeeId = RequestContext.currentEmployeeId();
		const currentRoleId = RequestContext.currentRoleId();

		// Destructure the input data
		const { memberIds = [], managerIds = [], organizationId, ...entity } = input;

		try {
			// If the current employee creates the sprint, defailt add him as a manager
			try {
				// Check if the current role is EMPLOYEE
				await this._roleService.findOneByIdString(currentRoleId, { where: { name: RolesEnum.EMPLOYEE } });

				// Add the current employee to the managerIds if they have the EMPLOYEE role and are not already included.
				if (!managerIds.includes(employeeId)) {
					// If not included, add the employeeId to the managerIds array.
					managerIds.push(employeeId);
				}
			} catch (error) {}

			// Combine memberIds and managerIds into a single array.
			const employeeIds = [...memberIds, ...managerIds].filter(Boolean);

			// Retrive a collection of employees based on specified criteria.
			const employees = await this._employeeService.findActiveEmployeesByEmployeeIds(
				employeeIds,
				organizationId,
				tenantId
			);

			// Find the manager role
			const managerRole = await this._roleService.findOneByWhereOptions({
				name: RolesEnum.MANAGER
			});

			// Create a Set for faster mambership checks
			const managerIdsSet = new Set(managerIds);

			// Use destructuring to directly extract 'id' from 'employee'
			const members = employees.map(({ id: employeeId }) => {
				// If the employee is manager, assign the existing manager with the latest assignedAt date.
				const isManager = managerIdsSet.has(employeeId);
				const assignedAt = new Date();

				return new OrganizationSprintEmployee({
					employeeId,
					organizationId,
					tenantId,
					isManager,
					assignedAt,
					role: isManager ? managerRole : null
				});
			});

			// Create the organization sprint with the prepared members.
			const sprint = await super.create({
				...entity,
				members,
				organizationId,
				tenantId
			});

			// Generate the activity log description.
			const description = generateActivityLogDescription(
				ActionTypeEnum.Created,
				ActivityLogEntityEnum.OrganizationSprint,
				sprint.name
			);

			// Emit an event to log the activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: ActivityLogEntityEnum.OrganizationSprint,
					entityId: sprint.id,
					action: ActionTypeEnum.Created,
					actorType: ActorTypeEnum.User,
					description,
					data: sprint,
					organizationId,
					tenantId
				})
			);

			return sprint;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to create organization sprint: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
