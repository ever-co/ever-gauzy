import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IBasePerTenantAndOrganizationEntityModel, IEmployee, IOrganizationTeamEmployee, IRelationalEmployee, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { Role } from '../role/role.entity';

@Injectable()
export class OrganizationTeamEmployeeService extends TenantAwareCrudService<OrganizationTeamEmployee> {
	constructor(
		@InjectRepository(OrganizationTeamEmployee)
		private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>
	) {
		super(organizationTeamEmployeeRepository);
	}

	async updateOrganizationTeam(
		teamId: string,
		organizationId: string,
		employeesToUpdate: IEmployee[],
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

			const tenantId = RequestContext.currentTenantId();

			// 3. Add new team members
			employeesToUpdate
				.filter((emp) => !existingMembers.includes(emp.id))
				.forEach(async (employee) => {
					const teamEmployee = new OrganizationTeamEmployee();
					teamEmployee.organizationTeamId = teamId;
					teamEmployee.employeeId = employee.id;
					teamEmployee.tenantId = tenantId;
					teamEmployee.organizationId = organizationId;
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

	/**
	 * Delete team member by memberId
	 *
	 * @param memberId
	 * @param options
	 * @returns
	 */
	async deleteTeamMember(
		memberId: IOrganizationTeamEmployee['id'],
		options: IBasePerTenantAndOrganizationEntityModel & IRelationalEmployee
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		try {
			const { employeeId, organizationId } = options;
			const member = await this.findOneByIdString(memberId, {
				where: {
					...(
						(RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) ? {
							employeeId,
							organizationId
						} : {
							employeeId: RequestContext.currentEmployeeId()
						}
					)
				}
			});
			return await this.repository.remove(member);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
