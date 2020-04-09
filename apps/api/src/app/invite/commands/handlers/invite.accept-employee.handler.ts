import { Invite, InviteStatusEnum } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AuthService } from '../../../auth/auth.service';
import { getUserDummyImage } from '../../../core';
import { Employee } from '../../../employee/employee.entity';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { OrganizationClientsService } from '../../../organization-clients/organization-clients.service';
import { OrganizationDepartmentService } from '../../../organization-department/organization-department.service';
import { OrganizationProjectsService } from '../../../organization-projects/organization-projects.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';

/**
 * Use this command for registering employees.
 * This command first registers a user, then creates an employee entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptEmployeeCommand)
export class InviteAcceptEmployeeHandler
	implements ICommandHandler<InviteAcceptEmployeeCommand> {
	constructor(
		private readonly inviteService: InviteService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly organizationProjectService: OrganizationProjectsService,
		private readonly organizationClientService: OrganizationClientsService,
		private readonly organizationDepartmentsService: OrganizationDepartmentService,
		private readonly authService: AuthService
	) {}

	public async execute(
		command: InviteAcceptEmployeeCommand
	): Promise<UpdateResult | Invite> {
		const { input } = command;

		const invite = await this.inviteService.findOne({
			where: { id: input.inviteId },
			relations: [
				'projects',
				'clients',
				'departments',
				'projects.members',
				'clients.members',
				'departments.members'
			]
		});

		if (!invite) {
			throw Error('Invite does not exist');
		}
		const organization = await this.organizationService.findOne(
			input.organization.id
		);
		if (!organization.invitesAllowed) {
			throw Error('Organization no longer allows invites');
		}

		if (!input.user.imageUrl) {
			input.user.imageUrl = getUserDummyImage(input.user);
		}

		const user = await this.authService.register(input);

		const employee = await this.employeeService.create({
			user,
			organization: input.organization
		});

		this.updateEmployeeMemberships(invite, employee);

		return await this.inviteService.update(input.inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}

	updateEmployeeMemberships = (invite: Invite, employee: Employee) => {
		//Update project members
		if (invite.projects)
			invite.projects.forEach((project) => {
				let members = project.members || [];
				members = [...members, employee];
				//This will call save() on the project (and not really create a new organization project)
				this.organizationProjectService.create({
					...project,
					members
				});
			});

		//Update client members
		invite.clients.forEach((client) => {
			let members = client.members || [];
			members = [...members, employee];
			//This will call save() on the client (and not really create a new organization client)
			this.organizationClientService.create({
				...client,
				members
			});
		});

		//Update department members
		invite.departments.forEach((department) => {
			let members = department.members || [];
			members = [...members, employee];
			//This will call save() on the department (and not really create a new organization department)
			this.organizationDepartmentsService.create({
				...department,
				members
			});
		});
	};
}
