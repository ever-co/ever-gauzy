import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { IEmployee, IInvite, InviteStatusEnum, IOrganizationContact, IOrganizationDepartment, IOrganizationProject, IOrganizationTeam } from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationProject,
	OrganizationTeam,
	OrganizationTeamEmployee
} from './../../../core/entities/internal';

/**
 * Use this command for registering employees.
 * This command first registers a user, then creates an employee entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptEmployeeCommand)
export class InviteAcceptEmployeeHandler implements ICommandHandler<InviteAcceptEmployeeCommand> {

	constructor(
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		@InjectRepository(Organization) private readonly organizationRepository: Repository<Organization>,
		@InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(OrganizationProject) private readonly organizationProjectRepository: Repository<OrganizationProject>,
		@InjectRepository(OrganizationContact) private readonly organizationContactRepository: Repository<OrganizationContact>,
		@InjectRepository(OrganizationDepartment) private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,
		@InjectRepository(OrganizationTeam) private readonly organizationTeamRepository: Repository<OrganizationTeam>
	) {}

	public async execute(
		command: InviteAcceptEmployeeCommand
	): Promise<UpdateResult | IInvite> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite: IInvite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				projects: true,
				departments: {
					members: true
				},
				organizationContacts: {
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

		await this.updateEmployeeMemberships(invite, employee);

		// this.inviteService.sendAcceptInvitationEmail(organization, employee, languageCode);

		return await this.inviteService.update(input.inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}

	/**
	 * Update employee memberships
	 *
	 * @param invite
	 * @param employee
	 */
	public async updateEmployeeMemberships(
		invite: IInvite,
		employee: IEmployee
	): Promise<void> {

		//Update project members
		if (invite.projects) {
			invite.projects.forEach(async (project: IOrganizationProject) => {
				let members = project.members || [];
				members = [...members, employee];
				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.organizationProjectRepository.create({
					...project,
					members
				});
				//This will call save() on the project (and not really create a new organization project)
				await this.organizationProjectRepository.save(create);
			});
		}

		//Update organization Contacts members
		if (invite.organizationContacts) {
			invite.organizationContacts.forEach(async (organizationContact: IOrganizationContact) => {
				let members = organizationContact.members || [];
				members = [...members, employee];
				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.organizationContactRepository.create({
					...organizationContact,
					members
				});
				//This will call save() on the project (and not really create a new organization contact)
				await this.organizationContactRepository.save(create);
			});
		}

		//Update department members
		if (invite.departments) {
			invite.departments.forEach(async (department: IOrganizationDepartment) => {
				let members = department.members || [];
				members = [...members, employee];
				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.organizationDepartmentRepository.create({
					...department,
					members
				});
				//This will call save() on the department (and not really create a new organization department)
				await this.organizationDepartmentRepository.save(create);
			});
		}

		//Update team members
		if (invite.teams) {
			invite.teams.forEach(async (team: IOrganizationTeam) => {
				let members = team.members || [];

				const member = new OrganizationTeamEmployee();
				member.organizationId = employee.organizationId;
				member.tenantId = employee.tenantId;
				member.employee = employee;

				members = [...members, member];
				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.organizationTeamRepository.create({
					...team,
					members
				});
				//This will call save() on the department (and not really create a new organization department)
				await this.organizationTeamRepository.save(create);
			});
		}
	}
}
