import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateResult } from 'typeorm';
import { IAppIntegrationConfig } from '@gauzy/common';
import {
	IEmployee,
	IInvite,
	InviteStatusEnum,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganizationProject,
	IOrganizationTeam,
	IUser,
	IUserRegistrationInput,
	LanguagesEnum,
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
	OrganizationProjectEmployee,
	OrganizationTeam,
	OrganizationTeamEmployee,
	User
} from './../../../core/entities/internal';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationContactRepository } from '../../../organization-contact/repository/type-orm-organization-contact.repository';
import { TypeOrmOrganizationDepartmentRepository } from '../../../organization-department/repository/type-orm-organization-department.repository';
import { TypeOrmOrganizationProjectRepository } from '../../../organization-project/repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationTeamRepository } from '../../../organization-team/repository/type-orm-organization-team.repository';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';

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
		@InjectRepository(User) private readonly typeOrmUserRepository: TypeOrmUserRepository,
		@InjectRepository(Employee) private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		@InjectRepository(OrganizationProject)
		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		@InjectRepository(OrganizationContact)
		private readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		@InjectRepository(OrganizationDepartment)
		private readonly typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,
		@InjectRepository(OrganizationTeam)
		private readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository
	) {}

	/**
	 * Executes the invite acceptance process for an employee.
	 * @param command The command containing the invite acceptance data.
	 * @returns The user associated with the invite.
	 */
	public async execute(command: InviteAcceptEmployeeCommand): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite = await this.findInviteWithRelations(inviteId);

		const { organization } = invite;
		if (!organization.invitesAllowed) {
			throw new Error('Organization no longer allows invites');
		}

		let user: IUser;
		let employee: IEmployee;

		try {
			// Find existing employee user
			user = await this.findExistingEmployeeUser(invite);

			// Implementation to find an employee by user ID
			employee = await this.findEmployee(user.id);
		} catch (error) {
			// New user registers before accepting the invitation
			user = await this.registerNewUser(input, invite, languageCode);

			// Create employee after creating user
			employee = await this.createEmployee(invite, user);
		}

		// Implementation for updating employee memberships based on the invite details
		await this.updateEmployeeMemberships(invite, employee);

		// Accept invitation
		await this.updateInviteStatus(inviteId, user.id);

		return user;
	}

	/**
	 * Finds an invite by its ID and loads its relations.
	 * @param inviteId The ID of the invite to find.
	 * @returns The found invite with its relations.
	 * @throws NotFoundException if the invite does not exist.
	 */
	private async findInviteWithRelations(inviteId: string): Promise<IInvite> {
		const invite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				projects: { members: true },
				departments: { members: true },
				organizationContacts: { members: true },
				teams: { members: true },
				organization: true
			}
		});
		if (!invite) {
			throw new NotFoundException('Invite does not exist');
		}
		return invite;
	}

	/**
	 * Finds an existing employee user based on the invite details.
	 * @param invite The invite containing the user's email and tenant ID.
	 * @returns The found user.
	 */
	private async findExistingEmployeeUser(invite: IInvite): Promise<IUser> {
		const { tenantId, email } = invite;
		return await this.typeOrmUserRepository.findOneOrFail({
			where: {
				email,
				tenantId,
				role: { name: RolesEnum.EMPLOYEE }
			},
			order: { createdAt: 'DESC' }
		});
	}

	/**
	 * Registers a new user based on the invite details.
	 * @param input The user registration input and app integration config.
	 * @param invite The invite containing the organization details.
	 * @param languageCode The language code for localization.
	 * @returns The registered user.
	 */
	private async registerNewUser(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		invite: IInvite,
		languageCode: LanguagesEnum
	): Promise<IUser> {
		const { id: organizationId, tenantId } = invite.organization;
		return await this.authService.register(
			{
				...input,
				user: { ...input.user, tenant: { id: tenantId } },
				organizationId,
				inviteId: invite.id
			},
			languageCode
		);
	}

	/**
	 * Creates an employee based on the invite details and user information.
	 * @param invite The invite containing the organization details.
	 * @param user The user to be associated with the employee.
	 * @returns The created employee.
	 */
	private async createEmployee(invite: IInvite, user: IUser): Promise<IEmployee> {
		const { organization, tenantId, actionDate } = invite;

		// Create employee after creating user
		const employee = this.typeOrmEmployeeRepository.create({
			user,
			organization,
			tenantId,
			startedWorkOn: actionDate || null,
			isActive: true,
			isArchived: false
		});

		return await this.typeOrmEmployeeRepository.save(employee);
	}

	/**
	 * Finds an employee based on the user ID.
	 * @param userId The ID of the user to find the employee for.
	 * @returns The found employee.
	 */
	private async findEmployee(userId: string): Promise<IEmployee> {
		return await this.typeOrmEmployeeRepository.findOneOrFail({
			where: { userId, user: { id: userId } }
		});
	}

	/**
	 * Updates the status of an invite to accepted and associates it with a user.
	 * @param inviteId The ID of the invite to update.
	 * @param userId The ID of the user who accepted the invite.
	 * @returns The updated invite or the update result.
	 */
	private async updateInviteStatus(inviteId: string, userId: string): Promise<IInvite | UpdateResult> {
		return await this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED,
			userId
		});
	}

	/**
	 * Update employee memberships
	 *
	 * @param invite
	 * @param employee
	 */
	public async updateEmployeeMemberships(invite: IInvite, employee: IEmployee): Promise<void> {
		//Update organization Contacts members
		if (invite.organizationContacts) {
			invite.organizationContacts.forEach(async (organizationContact: IOrganizationContact) => {
				let members = organizationContact.members || [];
				members = [...members, employee];
				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.typeOrmOrganizationContactRepository.create({
					...organizationContact,
					members
				});
				//This will call save() on the project (and not really create a new organization contact)
				await this.typeOrmOrganizationContactRepository.save(create);
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
				const create = this.typeOrmOrganizationDepartmentRepository.create({
					...department,
					members
				});
				//This will call save() on the department (and not really create a new organization department)
				await this.typeOrmOrganizationDepartmentRepository.save(create);
			});
		}

		//Update team members
		if (invite.teams) {
			invite.teams.forEach(async (team: IOrganizationTeam) => {
				let members = team.members || [];

				// Create new team member
				const member = new OrganizationTeamEmployee();
				member.organizationId = employee.organizationId;
				member.tenantId = employee.tenantId;
				member.employee = employee;

				// Add member to team
				members = [...members, member];

				/**
				 * Creates a new entity instance and copies all entity properties from this object into a new entity.
				 */
				const create = this.typeOrmOrganizationTeamRepository.create({
					...team,
					members
				});
				//This will call save() on the department (and not really create a new organization department)
				await this.typeOrmOrganizationTeamRepository.save(create);
			});
		}

		//Update project members
		if (invite.projects) {
			invite.projects.forEach(async (project: IOrganizationProject) => {
				// Get existing project members
				let members = project.members || [];

				// Create new project member
				const member = new OrganizationProjectEmployee();
				member.employee = employee;
				member.organizationId = employee.organizationId;
				member.tenantId = employee.tenantId;

				// Add member to project
				members = [...members, member];

				// Create new project
				const create = this.typeOrmOrganizationProjectRepository.create({
					...project,
					members
				});

				//This will call save() on the project (and not really create a new organization project)
				await this.typeOrmOrganizationProjectRepository.save(create);
			});
		}
	}
}
