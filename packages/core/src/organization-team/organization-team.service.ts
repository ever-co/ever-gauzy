import {
	Injectable,
	BadRequestException,
	HttpException,
	HttpStatus
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import {
	IOrganizationTeamCreateInput,
	IOrganizationTeam,
	RolesEnum,
	IPagination
} from '@gauzy/contracts';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { RequestContext } from '../core/context';
import { RoleService } from '../role/role.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';

@Injectable()
export class OrganizationTeamService extends TenantAwareCrudService<OrganizationTeam> {
	constructor(
		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		private readonly employeeService: EmployeeService,
		private readonly roleService: RoleService,
		private readonly organizationService: OrganizationService,
		private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService
	) {
		super(organizationTeamRepository);
	}

	async createOrgTeam(
		entity: IOrganizationTeamCreateInput
	): Promise<IOrganizationTeam> {
		const {
			tags,
			name,
			organizationId,
			members: memberIds,
			managers: managerIds
		} = entity;
		try {
			const tenantId = RequestContext.currentTenantId();

			const role = await this.roleService.findOneByOptions({
				where: { tenant: { id: tenantId }, name: RolesEnum.MANAGER }
			});
			const employees = await this.employeeRepository.findByIds(
				[...memberIds, ...managerIds],
				{
					relations: ['user']
				}
			);

			const teamEmployees: OrganizationTeamEmployee[] = [];
			employees.forEach((employee) => {
				const teamEmployee = new OrganizationTeamEmployee();
				teamEmployee.employeeId = employee.id;
				teamEmployee.organizationId = organizationId;
				teamEmployee.tenantId = tenantId;
				teamEmployee.role = managerIds.includes(employee.id)
					? role
					: null;
				teamEmployees.push(teamEmployee);
			});
			return await this.create({
				tags,
				organizationId,
				tenantId,
				name,
				members: teamEmployees
			});
		} catch (error) {
			throw new BadRequestException(`Failed to create a team: ${error}`);
		}
	}

	async updateOrgTeam(
		id: string,
		entity: IOrganizationTeamCreateInput
	): Promise<OrganizationTeam> {
		const {
			tags,
			name,
			organizationId,
			members: memberIds,
			managers: managerIds
		} = entity;
		try {
			const tenantId = RequestContext.currentTenantId();

			const role = await this.roleService.findOneByOptions({
				where: { tenant: { id: tenantId }, name: RolesEnum.MANAGER }
			});
			const employees = await this.employeeRepository.findByIds(
				[...memberIds, ...managerIds],
				{
					relations: ['user']
				}
			);

			// Update nested entity
			await this.organizationTeamEmployeeService.updateOrganizationTeam(
				id,
				organizationId,
				employees,
				role,
				managerIds,
				memberIds
			);

			const organizationTeam = await this.findOneByIdString(id);
			this.repository.merge(organizationTeam, { name, tags });

			return this.repository.save(organizationTeam);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async getMyOrgTeams(
		filter: FindManyOptions<OrganizationTeam>,
		employeeId
	): Promise<IPagination<IOrganizationTeam>> {
		const teams: OrganizationTeam[] = [];
		const items = await this.organizationTeamRepository.find(filter);

		for (const orgTeams of items) {
			for (const teamEmp of orgTeams.members) {
				if (employeeId === teamEmp.employeeId) {
					teams.push(orgTeams);
					break;
				}
			}
		}

		return { items: teams, total: teams.length };
	}

	async findMyTeams(relations, findInput, employeeId) {
		// If user is not an employee, then this will return 404
		let employee: any = { id: undefined };
		let role;
		try {
			employee = await this.employeeService.findOneByOptions({
				where: {
					user: { id: RequestContext.currentUserId() }
				}
			});
		} catch (e) {}

		try {
			const roleId = RequestContext.currentRoleId();
			if (roleId) {
				role = await this.roleService.findOneByIdString(roleId);
			}
		} catch (e) {}

		// selected user not passed
		if (employeeId) {
			if (role.name === RolesEnum.ADMIN || role.name === RolesEnum.SUPER_ADMIN) {
				return this.findAll({
					where: findInput,
					relations
				});
			} else if (employeeId === employee.id) {
				return this.getMyOrgTeams(
					{
						where: findInput,
						relations
					},
					employee.id
				);
			} else {
				throw new HttpException(
					'Unauthorized',
					HttpStatus.UNAUTHORIZED
				);
			}
		} else {
			if (role.name === RolesEnum.ADMIN || role.name === RolesEnum.SUPER_ADMIN) {
				return this.findAll({
					where: findInput,
					relations
				});
			} else {
				return this.getMyOrgTeams(
					{
						where: findInput,
						relations
					},
					employee.id
				);
			}
		}
	}
}
