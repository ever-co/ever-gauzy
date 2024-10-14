import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	ActionTypeEnum,
	EntityEnum,
	ActorTypeEnum,
	IActivityLogUpdatedValues,
	ID,
	IEmployee,
	IOrganizationSprint,
	IOrganizationSprintCreateInput,
	IOrganizationSprintUpdateInput,
	RolesEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
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

@FavoriteService(EntityEnum.OrganizationSprint)
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
			// If the current employee creates the sprint, default add him as a manager
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

			// Retrieve a collection of employees based on specified criteria.
			const employees = await this._employeeService.findActiveEmployeesByEmployeeIds(
				employeeIds,
				organizationId,
				tenantId
			);

			// Find the manager role
			const managerRole = await this._roleService.findOneByWhereOptions({
				name: RolesEnum.MANAGER
			});

			// Create a Set for faster membership checks
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
				EntityEnum.OrganizationSprint,
				sprint.name
			);

			// Emit an event to log the activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: EntityEnum.OrganizationSprint,
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

	/**
	 * Update an organization sprint.
	 *
	 * @param id - The ID of the organization sprint to be updated.
	 * @param input - The updated information for the organization sprint.
	 * @returns A Promise resolving to the updated organization sprint.
	 * @throws ForbiddenException if the user lacks permission or if certain conditions are not met.
	 * @throws BadRequestException if there's an error during the update process.
	 */
	async update(id: ID, input: IOrganizationSprintUpdateInput): Promise<IOrganizationSprint> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		// Destructure the input data
		const { memberIds = [], managerIds = [], organizationId, projectId } = input;

		try {
			// Search for existing Organization Sprint
			let organizationSprint = await super.findOneByIdString(id, {
				where: { organizationId, tenantId, projectId },
				relations: {
					members: true,
					modules: true
				}
			});

			// Retrieve members and managers IDs
			if (isNotEmpty(memberIds) || isNotEmpty(managerIds)) {
				// Combine memberIds and managerIds into a single array
				const employeeIds = [...memberIds, ...managerIds].filter(Boolean);

				// Retrieve a collection of employees based on specified criteria.
				const sprintMembers = await this._employeeService.findActiveEmployeesByEmployeeIds(
					employeeIds,
					organizationId,
					tenantId
				);

				// Update nested entity (Organization Sprint Members)
				await this.updateOrganizationSprintMembers(id, organizationId, sprintMembers, managerIds, memberIds);

				// Update the organization sprint with the prepared members
				const { id: organizationSprintId } = organizationSprint;
				const updatedSprint = await super.create({
					...input,
					organizationId,
					tenantId,
					id: organizationSprintId
				});

				const description = generateActivityLogDescription(
					ActionTypeEnum.Updated,
					EntityEnum.OrganizationSprint,
					updatedSprint.name
				);

				// Compare values before and after update then add updates to fields
				const updatedFields = [];
				const previousValues: IActivityLogUpdatedValues[] = [];
				const updatedValues: IActivityLogUpdatedValues[] = [];

				for (const key of Object.keys(input)) {
					if (organizationSprint[key] !== input[key]) {
						// Add updated field
						updatedFields.push(key);

						// Add old and new values
						previousValues.push({ [key]: organizationSprint[key] });
						updatedValues.push({ [key]: updatedSprint[key] });
					}
				}

				// Emit event to log activity
				this._eventBus.publish(
					new ActivityLogEvent({
						entity: EntityEnum.OrganizationSprint,
						entityId: updatedSprint.id,
						action: ActionTypeEnum.Updated,
						actorType: ActorTypeEnum.User,
						description,
						updatedFields,
						updatedValues,
						previousValues,
						data: updatedSprint,
						organizationId,
						tenantId
					})
				);

				// return updated sprint
				return updatedSprint;
			}
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to update organization sprint: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Delete sprint members by IDs.
	 *
	 * @param memberIds - Array of member IDs to delete
	 * @returns A promise that resolves when all deletions are complete
	 */
	async deleteMemberByIds(memberIds: ID[]): Promise<void> {
		// Map member IDs to deletion promises
		const deletePromises = memberIds.map((memberId) =>
			this.typeOrmOrganizationSprintEmployeeRepository.delete(memberId)
		);

		// Wait for all deletions to complete
		await Promise.all(deletePromises);
	}

	/**
	 * Updates an organization sprint by managing its members and their roles.
	 *
	 * @param organizationSprintId - ID of the organization sprint
	 * @param organizationId - ID of the organization
	 * @param employees - Array of employees to be assigned to the sprint
	 * @param managerIds - Array of employee IDs to be assigned as managers
	 * @param memberIds - Array of employee IDs to be assigned as members
	 * @returns Promise<void>
	 */
	async updateOrganizationSprintMembers(
		organizationSprintId: ID,
		organizationId: ID,
		employees: IEmployee[],
		managerIds: ID[],
		memberIds: ID[]
	): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const membersToUpdate = new Set([...managerIds, ...memberIds].filter(Boolean));

		// Find the manager role.
		const managerRole = await this._roleService.findOneByWhereOptions({
			name: RolesEnum.MANAGER
		});

		// Fetch existing sprint members with their roles.
		const sprintMembers = await this.typeOrmOrganizationSprintEmployeeRepository.find({
			where: { tenantId, organizationId, organizationSprintId }
		});

		// Create a map of existing members for quick lookup
		const existingMemberMap = new Map(sprintMembers.map((member) => [member.employeeId, member]));

		// Separate members into removed, updated and new members
		const removedMembers = sprintMembers.filter((member) => !membersToUpdate.has(member.employeeId));
		const updatedMembers = sprintMembers.filter((member) => membersToUpdate.has(member.employeeId));
		const newMembers = employees.filter((employee) => !existingMemberMap.has(employee.id));

		// 1. Remove members who are no longer assigned to the sprint
		if (removedMembers.length) {
			await this.deleteMemberByIds(removedMembers.map((member) => member.id));
		}

		// 2. Update roles for existing members where necessary.
		await Promise.all(
			updatedMembers.map(async (member) => {
				const isManager = managerIds.includes(member.employeeId);
				const newRole = isManager ? managerRole : null;

				// Only update if the role has changed
				if (newRole && newRole.id !== member.roleId) {
					await this.typeOrmOrganizationSprintEmployeeRepository.update(member.id, { role: newRole });
				}
			})
		);

		// 3. Add new members to the sprint
		if (newMembers.length) {
			const newSprintMembers = newMembers.map(
				(employee) =>
					new OrganizationSprintEmployee({
						organizationSprintId,
						employeeId: employee.id,
						tenantId,
						organizationId,
						isManager: managerIds.includes(employee.id),
						roleId: managerIds.includes(employee.id) ? managerRole.id : null
					})
			);

			await this.typeOrmOrganizationSprintEmployeeRepository.save(newSprintMembers);
		}
	}
}
