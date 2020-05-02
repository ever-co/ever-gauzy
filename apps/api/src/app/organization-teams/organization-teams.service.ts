import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import {
	OrganizationTeamCreateInput as IOrganizationTeamCreateInput,
	OrganizationTeams as IOrganizationTeams
} from '@gauzy/models';
import { IPagination } from '../core';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { OrganizationTeams } from './organization-teams.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';

@Injectable()
export class OrganizationTeamsService extends CrudService<OrganizationTeams> {
	constructor(
		@InjectRepository(OrganizationTeams)
		private readonly organizationTeamsRepository: Repository<
			OrganizationTeams
		>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {
		super(organizationTeamsRepository);
	}

	async createOrgTeam(
		entity: IOrganizationTeamCreateInput
	): Promise<OrganizationTeams> {
		const organizationTeam = new OrganizationTeams();
		organizationTeam.name = entity.name;
		organizationTeam.organizationId = entity.organizationId;

		const employees = await this.employeeRepository.findByIds(
			entity.members,
			{
				relations: ['user']
			}
		);

		const teamEmployees: OrganizationTeamEmployee[] = [];
		employees.forEach((employee) => {
			const teamEmployee = new OrganizationTeamEmployee();
			teamEmployee.employeeId = employee.id;
			teamEmployee.employee = employee;
			teamEmployees.push(teamEmployee);
		});
		organizationTeam.members = teamEmployees;

		return this.organizationTeamsRepository.save(organizationTeam);
	}

	async updateOrgTeam(
		id: string,
		entity: IOrganizationTeamCreateInput
	): Promise<OrganizationTeams> {
		try {
			await this.organizationTeamsRepository.delete(id);

			const organizationTeam = new OrganizationTeams();
			organizationTeam.name = entity.name;
			organizationTeam.organizationId = entity.organizationId;
			const employees = await this.employeeRepository.findByIds(
				entity.members,
				{
					relations: ['user']
				}
			);

			const teamEmployees: OrganizationTeamEmployee[] = [];
			employees.forEach((employee) => {
				const teamEmployee = new OrganizationTeamEmployee();
				teamEmployee.employeeId = employee.id;
				teamEmployee.employee = employee;
				teamEmployees.push(teamEmployee);
			});
			organizationTeam.members = teamEmployees;

			return this.organizationTeamsRepository.save(organizationTeam);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async getAllOrgTeams(
		filter: FindManyOptions<OrganizationTeams>
	): Promise<IPagination<IOrganizationTeams>> {
		const total = await this.organizationTeamsRepository.count(filter);

		const items = await this.organizationTeamsRepository.find(filter);

		for (const orgTeams of items) {
			for (const teamEmp of orgTeams.members) {
				const emp = await this.employeeRepository.findOne(
					teamEmp.employeeId
				);
				emp.user = await this.userRepository.findOne(emp.userId);
				teamEmp.employee = emp;
			}
		}

		return { items, total };
	}
}
