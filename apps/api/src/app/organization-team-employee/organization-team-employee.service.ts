import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { Role } from '../role/role.entity';
import { Employee } from '@gauzy/models';

@Injectable()
export class OrganizationTeamEmployeeService extends CrudService<
	OrganizationTeamEmployee
> {
	constructor(
		@InjectRepository(OrganizationTeamEmployee)
		private readonly OrganizationTeamEmployeeRepository: Repository<
			OrganizationTeamEmployee
		>
	) {
		super(OrganizationTeamEmployeeRepository);
	}

	async updateOrganizationTeam(
		teamId: string,
		employeesToUpdate: Employee[],
		role: Role,
		managerIds: string[],
		memberIds: string[]
	) {
		const members = [...managerIds, ...memberIds];

		const { items: existingEmployees } = await this.findAll({
			where: { organizationTeamId: teamId },
			relations: ['role']
		});
		if (existingEmployees) {
			const existingMembers = existingEmployees.map(
				(emp) => emp.employeeId
			);

			// 1. Remove employees from the team
			const removedMemberIds =
				existingEmployees
					.filter(
						(employee) => !members.includes(employee.employeeId)
					)
					.map((emp) => emp.id) || [];
			this.deleteMemberByIds(removedMemberIds);

			// 2. Update role of employees that already exist in the system
			existingEmployees
				.filter((employee) => members.includes(employee.employeeId))
				.forEach(async (employee) => {
					await this.update(employee.id, {
						role: managerIds.includes(employee.employeeId)
							? role
							: null
					});
				});

			// 3. Add new team members
			employeesToUpdate
				.filter((emp) => !existingMembers.includes(emp.id))
				.forEach(async (employee) => {
					const teamEmployee = new OrganizationTeamEmployee();
					teamEmployee.organizationTeamId = teamId;
					teamEmployee.employee = employee;
					teamEmployee.employeeId = employee.id;
					teamEmployee.role = managerIds.includes(employee.id)
						? role
						: null;
					this.create(teamEmployee);
				});
		}
	}
	deleteMemberByIds(memberIds: string[]) {
		memberIds.forEach(async (memberId) => {
			await this.delete(memberId);
		});
	}
}
