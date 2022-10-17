import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { IEmployee, IInvite, InviteStatusEnum, IOrganizationTeam } from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { OrganizationContactService } from '../../../organization-contact/organization-contact.service';
import { OrganizationDepartmentService } from '../../../organization-department/organization-department.service';
import { OrganizationProjectService } from '../../../organization-project/organization-project.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { Employee, Organization, OrganizationTeamEmployee } from './../../../core/entities/internal';

/**
 * Use this command for registering employees.
 * This command first registers a user, then creates an employee entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptEmployeeCommand)
export class InviteAcceptEmployeeHandler implements ICommandHandler<InviteAcceptEmployeeCommand> {

	constructor(
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(OrganizationTeamEmployee)
		private readonly organizationTeamEmployee: Repository<OrganizationTeamEmployee>,

		private readonly inviteService: InviteService,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationDepartmentsService: OrganizationDepartmentService,
		private readonly authService: AuthService
	) {}

	public async execute(
		command: InviteAcceptEmployeeCommand
	): Promise<UpdateResult | IInvite> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				projects: true,
				departments: {
					members: true
				},
				organizationContact: {
					members: true
				},
				teams: {
					members: true
				}
			}
		});
		if (!invite) {
			throw Error('Invite does not exist');
		}

		const { organizationId, tenantId } = invite;
		const organization = await this.organizationRepository.findOneBy({
			id: organizationId,
			tenantId
		});
		if (!organization.invitesAllowed) {
			throw Error('Organization no longer allows invites');
		}

		/**
		 * User register after accept invitation
		 */
		const user = await this.authService.register(
			{
				...input,
				user: {
					...input.user,
					tenant: {
						id: organization.tenantId
					}
				},
				organizationId
			},
			languageCode
		);
		/**
		 * Create employee after create user
		 */
		const create = this.employeeRepository.create({
			user,
			organization,
			tenantId,
			startedWorkOn: invite.actionDate || null
		});
		const employee = await this.employeeRepository.save(create);

		this.updateEmployeeMemberships(invite, employee);

		// this.inviteService.sendAcceptInvitationEmail(organization, employee, languageCode);

		return await this.inviteService.update(input.inviteId, {
			status: InviteStatusEnum.INVITED
		});
	}

	updateEmployeeMemberships = (invite: IInvite, employee: IEmployee) => {
		//Update project members
		if (invite.projects) {
			invite.projects.forEach((project) => {
				let members = project.members || [];
				members = [...members, employee];
				//This will call save() on the project (and not really create a new organization project)
				this.organizationProjectService.create({
					...project,
					members
				});
			});
		}

		//Update organization Contacts members
		if (invite.organizationContacts) {
			invite.organizationContacts.forEach((organizationContact) => {
				let members = organizationContact.members || [];
				members = [...members, employee];
				//This will call save() on the organizationContacts (and not really create a new organization Contacts)
				this.organizationContactService.create({
					...organizationContact,
					members
				});
			});
		}

		//Update department members
		if (invite.departments) {
			invite.departments.forEach((department) => {
				let members = department.members || [];
				members = [...members, employee];
				//This will call save() on the department (and not really create a new organization department)
				this.organizationDepartmentsService.create({
					...department,
					members
				});
			});
		}

		//Update team members
		if (invite.teams) {
			invite.teams.forEach((team: IOrganizationTeam) => {
				let members = team.members || [];
				console.log(team, members);
			});
		}
	};
}
