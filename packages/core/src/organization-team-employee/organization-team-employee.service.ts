import { ForbiddenException, Injectable } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import {
	ID,
	IEmployee,
	IOrganizationTeamEmployeeActiveTaskUpdateInput,
	IOrganizationTeamEmployeeFindInput,
	IOrganizationTeamEmployeeUpdateInput,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { Role } from './../core/entities/internal';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { TaskService } from './../tasks/task.service';
import { MikroOrmOrganizationTeamEmployeeRepository, TypeOrmOrganizationTeamEmployeeRepository } from './repository';

@Injectable()
export class OrganizationTeamEmployeeService extends TenantAwareCrudService<OrganizationTeamEmployee> {
	constructor(
		readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		readonly mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,
		private readonly taskService: TaskService
	) {
		super(typeOrmOrganizationTeamEmployeeRepository, mikroOrmOrganizationTeamEmployeeRepository);
	}

	/**
	 * Update organization team by managing its members and their roles.
	 *
	 * @param organizationTeamId - ID of the organization team
	 * @param organizationId - ID of the organization
	 * @param employees - Array of employees to be assigned to the team
	 * @param role - The role to assign to managers in the team
	 * @param managerIds - Array of employee IDs to be assigned as managers
	 * @param memberIds - Array of employee IDs to be assigned as members
	 * @returns Promise<void>
	 */
	async updateOrganizationTeam(
		organizationTeamId: ID,
		organizationId: ID,
		employees: IEmployee[],
		role: Role,
		managerIds: ID[],
		memberIds: ID[]
	): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const membersToUpdate = new Set([...managerIds, ...memberIds].filter(Boolean));

		// Fetch existing team members with their roles
		const teamMembers = await this.typeOrmOrganizationTeamEmployeeRepository.find({
			where: { tenantId, organizationId, organizationTeamId },
			relations: { role: true }
		});

		// Create a map for fast lookup of current team members
		const existingMemberMap = new Map(teamMembers.map((member) => [member.employeeId, member]));

		// Separate members to remove and to update
		const removedMembers = teamMembers.filter((member) => !membersToUpdate.has(member.employeeId));
		const updatedMembers = teamMembers.filter((member) => membersToUpdate.has(member.employeeId));

		// 1. Remove members who are no longer in the team
		if (removedMembers.length > 0) {
			await this.deleteMemberByIds(removedMembers.map((member) => member.id));
		}

		// 2. Update role for existing members
		await Promise.all(
			updatedMembers.map(async (member) => {
				const isManager = managerIds.includes(member.employeeId);
				const newRole = isManager ? role : null;

				// Only update if the role has changed
				if (newRole && newRole.id !== member.roleId) {
					await this.typeOrmOrganizationTeamEmployeeRepository.update(member.id, {
						role: newRole,
						isManager
					});
				}
			})
		);

		// 3. Add new members to the team
		const newMembers = employees.filter((employee) => !existingMemberMap.has(employee.id));

		if (newMembers.length > 0) {
			const newTeamMembers = newMembers.map(
				(employee) =>
					new OrganizationTeamEmployee({
						organizationTeamId,
						employeeId: employee.id,
						tenantId,
						organizationId,
						roleId: managerIds.includes(employee.id) ? role.id : null
					})
			);

			await this.typeOrmOrganizationTeamEmployeeRepository.save(newTeamMembers);
		}
	}

	/**
	 * Delete team members by IDs.
	 *
	 * @param memberIds - Array of member IDs to delete
	 * @returns A promise that resolves when all deletions are complete
	 */
	async deleteMemberByIds(memberIds: ID[]): Promise<void> {
		console.warn('deletedIds:', memberIds);

		// Map member IDs to deletion promises
		const deletePromises = memberIds.map((memberId: ID) =>
			this.typeOrmOrganizationTeamEmployeeRepository.delete(memberId)
		);

		// Wait for all deletions to complete
		await Promise.all(deletePromises);
	}

	/**
	 * Update organization team member entity
	 *
	 * @param memberId - The ID of the organization team member to update
	 * @param entity - The input data for updating the organization team member
	 * @returns The updated OrganizationTeamEmployee or UpdateResult
	 */
	public async update(
		memberId: ID,
		entity: IOrganizationTeamEmployeeUpdateInput
	): Promise<OrganizationTeamEmployee | UpdateResult> {
		try {
			const { organizationId, organizationTeamId } = entity;
			const tenantId = RequestContext.currentTenantId() || entity.tenantId;

			// Create a where clause for the employee
			const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
				tenantId,
				organizationId,
				organizationTeamId
			};

			// Check if user has permission to change the selected employee
			if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				try {
					// Retrieve the current employee ID
					const employeeId = RequestContext.currentEmployeeId();

					// Verify if the employee has a manager role in the organization and team
					await this.findOneByWhereOptions({
						employeeId,
						role: { name: RolesEnum.MANAGER },
						...whereClause
					});

					// If the employee is a manager, proceed with the update
					return await super.update({ id: memberId, ...whereClause }, entity);
				} catch (error) {
					throw new ForbiddenException('You do not have sufficient permissions to perform this action.');
				}
			}

			// If user has permission, proceed with the update
			return await super.update({ id: memberId, ...whereClause }, entity);
		} catch (error) {
			throw new ForbiddenException('An error occurred while updating the organization team member.');
		}
	}

	/**
	 * Update organization team member active task entity
	 *
	 * @param memberId - The ID of the organization team member to update
	 * @param entity - The input data for updating the active task
	 * @returns The updated OrganizationTeamEmployee or UpdateResult
	 */
	public async updateActiveTask(
		memberId: ID,
		entity: IOrganizationTeamEmployeeActiveTaskUpdateInput
	): Promise<OrganizationTeamEmployee | UpdateResult> {
		try {
			const { organizationId, organizationTeamId, activeTaskId } = entity;
			const tenantId = RequestContext.currentTenantId();

			// Create a where clause for the employee
			const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
				tenantId,
				organizationId,
				organizationTeamId
			};

			// Admins and Super Admins can update the activeTaskId of any employee
			if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				const member = await this.typeOrmRepository.findOneOrFail({
					where: { id: memberId, ...whereClause }
				});

				// Update the active task ID
				return await this.typeOrmRepository.update(member.id, { activeTaskId });
			}

			// Non-admin: Employee must update their own task or manage their team as a manager
			const employeeId = RequestContext.currentEmployeeId();

			if (employeeId) {
				// Check if employee is a manager of the team
				try {
					await this.findOneByWhereOptions({
						...whereClause,
						role: { name: RolesEnum.MANAGER }
					});

					// If employee is a manager, update the active task ID for the team
					whereClause.id = memberId;
				} catch (error) {
					// If employee is not a manager, update the active task ID for themselves
					whereClause.employeeId = employeeId;
				}

				// Find the organization team employee
				const member = await this.typeOrmRepository.findOneByOrFail(whereClause);

				// Update the active task ID
				return await this.typeOrmRepository.update(
					{ id: member.id, organizationId, organizationTeamId, tenantId },
					{ activeTaskId }
				);
			}

			throw new ForbiddenException('You do not have permission to update this active task.');
		} catch (error) {
			throw new ForbiddenException('An error occurred while updating the active task.');
		}
	}

	/**
	 * Delete a team member by their ID.
	 *
	 * @param memberId - ID of the team member to delete
	 * @param options - Options for the team member find query
	 * @returns A promise resolving to the result of the deletion operation
	 */
	async deleteTeamMember(
		memberId: ID,
		options: IOrganizationTeamEmployeeFindInput
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		const { organizationId, organizationTeamId } = options;
		const tenantId = RequestContext.currentTenantId() || options.tenantId;

		// create a where clause for the employee
		const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
			tenantId,
			organizationId,
			organizationTeamId
		};

		try {
			if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				// Get member
				const member = await this.typeOrmRepository.findOneOrFail({
					where: {
						id: memberId,
						...whereClause
					}
				});

				// Unassign employee all tasks before removing from team
				await this.taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId);

				// Remove the team member
				return await this.typeOrmRepository.remove(member);
			} else {
				const employeeId = RequestContext.currentEmployeeId();

				// Check if the current user has an employee context
				if (!employeeId) {
					throw new ForbiddenException('You do not have permission to delete this team member.');
				}

				try {
					// If employee has manager of the team, he/she should be able to remove members from the team
					await this.findOneByWhereOptions({
						...whereClause,
						role: { name: RolesEnum.MANAGER }
					});

					// If employee is a manager, remove the member from the team
					whereClause.id = memberId;
				} catch (error) {
					// If employee is not a manager, he/she can only remove himself from the team
					whereClause.employeeId = employeeId;
				}

				// Find the organization team employee
				const member = await this.typeOrmRepository.findOneByOrFail(whereClause);

				// Unassign employee all tasks before removing from the team
				await this.taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId);

				// Remove the team member
				return await this.typeOrmRepository.remove(member);
			}
		} catch (error) {
			throw new ForbiddenException('An error occurred while deleting the team member.');
		}
	}
}
