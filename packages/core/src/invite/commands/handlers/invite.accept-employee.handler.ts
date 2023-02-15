import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IEmployee,
	IInvite,
	InviteStatusEnum,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganizationProject,
	IOrganizationTeam,
	IUser,
	RolesEnum
} from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import {
	Employee,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationProject,
	OrganizationTeam,
	OrganizationTeamEmployee,
	User
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
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(OrganizationProject) private readonly organizationProjectRepository: Repository<OrganizationProject>,
		@InjectRepository(OrganizationContact) private readonly organizationContactRepository: Repository<OrganizationContact>,
		@InjectRepository(OrganizationDepartment) private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,
		@InjectRepository(OrganizationTeam) private readonly organizationTeamRepository: Repository<OrganizationTeam>
	) { }

	public async execute(
		command: InviteAcceptEmployeeCommand
	): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite: IInvite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				projects: {
					members: true
				},
				departments: {
					members: true
				},
				organizationContacts: {
					members: true
				},
				teams: {
					members: true
				},
				organization: true
			}
		});
		if (!invite) {
			throw Error('Invite does not exist');
		}

		const { organization } = invite;
		if (!organization.invitesAllowed) {
			throw Error('Organization no longer allows invites');
		}

		let user: IUser;
		try {
			const { tenantId, email } = invite;
			user = await this.userRepository.findOneOrFail({
				where: {
					email,
					tenantId,
					role: {
						name: RolesEnum.EMPLOYEE
					}
				},
				relations: {
					employee: true
				},
				order: {
					createdAt: 'DESC'
				}
			});
			await this.updateEmployeeMemberships(invite, user.employee);
		} catch (error) {
			const { id: organizationId, tenantId } = organization;
			/**
			 * User register after accept invitation
			 */
			user = await this.authService.register(
				{
					...input,
					user: {
						...input.user,
						tenant: {
							id: tenantId
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
				startedWorkOn: invite.actionDate || new Date(),
				isActive: true
			});
			const employee = await this.employeeRepository.save(create);
			await this.updateEmployeeMemberships(invite, employee);
		}

		const { id } = user;
		await this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED,
			userId: id
		});

		return user;
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
