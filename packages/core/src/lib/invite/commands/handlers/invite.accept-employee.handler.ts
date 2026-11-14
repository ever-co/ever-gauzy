import { NotFoundException, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Raw, UpdateResult } from 'typeorm';
import { IAppIntegrationConfig } from '@gauzy/common';
import {
	IEmployee,
	IInvite,
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
	OrganizationProjectEmployee,
	OrganizationTeamEmployee,
	User,
	UserOrganization
} from './../../../core/entities/internal';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationContactRepository } from '../../../organization-contact/repository/type-orm-organization-contact.repository';
import { TypeOrmOrganizationDepartmentRepository } from '../../../organization-department/repository/type-orm-organization-department.repository';
import { TypeOrmOrganizationProjectRepository } from '../../../organization-project/repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationTeamRepository } from '../../../organization-team/repository/type-orm-organization-team.repository';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';
import { EmployeePlaceholderTransferService } from '../../../employee-placeholder/employee-placeholder-transfer.service';

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
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		private readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		private readonly typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,
		private readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		private readonly placeholderTransferService: EmployeePlaceholderTransferService
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

		// Claim the invite BEFORE registering anyone — see InviteService.claimInvite. Everything
		// above this line is a read, so two parallel acceptances of the same invite are both still
		// live here; the conditional flip to ACCEPTED is what picks a single winner.
		if (!(await this.inviteService.claimInvite(inviteId))) {
			throw new ConflictException('Invite has already been accepted');
		}

		let user: IUser;
		let employee: IEmployee;
		// Whether a claim got past the account check: from there on, any account its email gains is this attempt's.
		let registers = false;

		// A claim invitation hands a member without an account over to the person who accepts it (#11913).
		const isClaim = !!invite.placeholderEmployeeId;

		try {
			if (isClaim) {
				// Accepting signs in with the invitation alone, so a claim never opens an existing account, whatever
				// its role: the person behind it is reached by a merge instead. It registers the person's new account.
				if (await this.hasAccount(invite)) {
					throw new ConflictException(
						'This email already has an account: an admin merges the member without an account into theirs.'
					);
				}
				registers = true;
				user = await this.registerNewUser(input, invite, languageCode);
				employee = await this.createEmployee(invite, user);
			} else {
				// Inner try/catch is find-or-register control flow, not error handling: a missing
				// employee user is the signal to create one.
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
			}

			// Implementation for updating employee memberships based on the invite details
			await this.updateEmployeeMemberships(invite, employee);

			if (isClaim) {
				const kept = { keepInviteId: invite.id };
				const { placeholderEmployeeId, tenantId } = invite;
				await this.placeholderTransferService.transfer(placeholderEmployeeId, employee.id, tenantId, kept);
			}
		} catch (error) {
			// A failed claim retires the account it registered, even one a registration saved before failing: the next
			// acceptance would otherwise find it and refuse.
			if (registers) {
				await this.retireClaimAccounts(invite);
			}
			// Nothing consumed the invite after all — hand it back rather than stranding it as
			// ACCEPTED with no employee attached.
			await this.inviteService.releaseInvite(inviteId);
			throw error;
		}

		// Attach the accepted user; the status itself was already claimed above.
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
	 * Whether the invited email has an account in the invitation's tenant, whatever its role, compared without regard
	 * to case.
	 * @param invite The claim invitation being accepted.
	 */
	private async hasAccount(invite: IInvite): Promise<boolean> {
		return (await this.accountsOf(invite)).length > 0;
	}

	/**
	 * The live accounts of the invited email in the invitation's tenant, whatever their role, compared without regard
	 * to case.
	 * @param invite The claim invitation being accepted.
	 */
	private async accountsOf(invite: IInvite): Promise<IUser[]> {
		const { tenantId } = invite;
		const email = invite.email.toLowerCase();
		return await this.typeOrmUserRepository.find({
			where: { tenantId, email: Raw((column) => `LOWER(${column}) = :email`, { email }) }
		});
	}

	/**
	 * Retires the accounts a failed claim registered, as a merged placeholder's user is retired: deactivated, archived
	 * and soft-deleted, with their members and organization links. The email had none when the claim got past its
	 * check, so the ones it has now were made by this attempt, even by a registration that saved the account and then
	 * failed. Each write stands on its own, the account's first, so one that fails does not keep the others from being
	 * made, and the claim's own error stays the one reported. Not deleted: deleting a user makes the database check
	 * every table naming one.
	 *
	 * @param invite The claim invitation whose acceptance failed.
	 */
	private async retireClaimAccounts(invite: IInvite): Promise<void> {
		const retired = { isActive: false, isArchived: true, deletedAt: new Date() };
		const { manager } = this.typeOrmUserRepository;
		const attempt = async (what: string, write: () => Promise<unknown>) => {
			try {
				await write();
			} catch (cleanup) {
				console.error(`Failed to retire ${what} after a failed claim:`, cleanup);
			}
		};
		let accounts: IUser[] = [];
		await attempt(`the accounts of invitation ${invite.id}`, async () => {
			accounts = await this.accountsOf(invite);
		});
		for (const { id } of accounts) {
			await attempt(`the account ${id}`, () => manager.update(User, { id }, retired));
			await attempt(`the members of ${id}`, () => manager.update(Employee, { userId: id }, retired));
			await attempt(`the organization links of ${id}`, () =>
				manager.update(UserOrganization, { userId: id }, retired)
			);
		}
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
	 * Associates an already-claimed invite with the user who accepted it.
	 *
	 * The ACCEPTED status is set by `InviteService.claimInvite` before registration, so this only
	 * records the resulting user — writing the status here as well would reopen the race it closes.
	 *
	 * @param inviteId The ID of the invite to update.
	 * @param userId The ID of the user who accepted the invite.
	 * @returns The updated invite or the update result.
	 */
	private async updateInviteStatus(inviteId: string, userId: string): Promise<IInvite | UpdateResult> {
		return await this.inviteService.update(inviteId, {
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
		// Update organization Contacts members
		if (invite.organizationContacts) {
			await Promise.all(
				invite.organizationContacts.map(async (organizationContact: IOrganizationContact) => {
					let members = organizationContact.members || [];
					members = [...members, employee];
					/**
					 * Creates a new entity instance and copies all entity properties from this object into a new entity.
					 */
					const create = this.typeOrmOrganizationContactRepository.create({
						...organizationContact,
						members
					});
					// This will call save() on the project (and not really create a new organization contact)
					await this.typeOrmOrganizationContactRepository.save(create);
				})
			);
		}

		// Update department members
		if (invite.departments) {
			await Promise.all(
				invite.departments.map(async (department: IOrganizationDepartment) => {
					let members = department.members || [];
					members = [...members, employee];
					/**
					 * Creates a new entity instance and copies all entity properties from this object into a new entity.
					 */
					const create = this.typeOrmOrganizationDepartmentRepository.create({
						...department,
						members
					});
					// This will call save() on the department (and not really create a new organization department)
					await this.typeOrmOrganizationDepartmentRepository.save(create);
				})
			);
		}

		// Update team members
		if (invite.teams) {
			await Promise.all(
				invite.teams.map(async (team: IOrganizationTeam) => {
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
					// This will call save() on the department (and not really create a new organization department)
					await this.typeOrmOrganizationTeamRepository.save(create);
				})
			);
		}

		// Update project members
		if (invite.projects) {
			await Promise.all(
				invite.projects.map(async (project: IOrganizationProject) => {
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

					// This will call save() on the project (and not really create a new organization project)
					await this.typeOrmOrganizationProjectRepository.save(create);
				})
			);
		}
	}
}
