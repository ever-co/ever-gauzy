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
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { assertEmployeeNotEnded, createInvitedEmployee } from '../../invited-employee';
import { ExistingAccountSignInRequiredException } from '../../existing-account-sign-in-required';
import { RequestContext } from './../../../core/context';

/**
 * Use this command for registering employees.
 * This command first registers a user, then creates an employee entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
/**
 * Runs a write, and runs it again, up to three times in all, while it fails: a deadlock or a dropped connection
 * passes. The last failure is thrown.
 */
async function triedAgain<T>(write: () => Promise<T>, times = 3): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await write();
		} catch (error) {
			if (attempt >= times) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
		}
	}
}

/** Whether an account may still sign in: neither deactivated nor archived. */
function isActiveAccount(account: IUser): boolean {
	const deactivated = account.isActive === false;
	const archived = account.isArchived === true;
	return !deactivated && !archived;
}

/** Whether a team or project membership row is an active one of this employee. */
function isActiveMembershipOf(
	member: { employeeId?: string; employee?: { id?: string }; isActive?: boolean; isArchived?: boolean },
	employee: IEmployee
): boolean {
	const memberEmployeeId = member.employeeId ?? member.employee?.id;
	return memberEmployeeId === employee.id && member.isActive !== false && member.isArchived !== true;
}

/** Orders accounts from the most recently created. */
function newestFirst(first: IUser, second: IUser): number {
	return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}

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
		private readonly placeholderTransferService: EmployeePlaceholderTransferService,
		private readonly userOrganizationService: UserOrganizationService
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
		// The account this claim registered, told by the registration as soon as it is saved.
		let registeredId: string | undefined;

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
				user = await this.registerNewUser(input, invite, languageCode, (saved) => (registeredId = saved.id));
				employee = await this.createEmployee(invite, user);
			} else {
				// An address that has an account is accepted from that account's own session only (InviteAcceptHandler),
				// so the session's account is the one that joins: the answer never carries another account of the address.
				const sessionAccount = await this.findSessionAccount(invite);
				if (sessionAccount) {
					({ user, employee } = await this.joinWithAccount(invite, sessionAccount));
				} else {
					// Without that session, an account of the address that can sign in is never opened: the
					// InviteAcceptHandler refuses such an acceptance first, and one created since is refused here, before
					// anything is written.
					if (await this.findActiveAccount(invite)) {
						throw new ExistingAccountSignInRequiredException();
					}
					// Inner try/catch is find-or-register control flow, not error handling: a missing
					// employee user is the signal to create one.
					try {
						// Find existing employee user
						user = await this.findExistingEmployeeUser(invite);

						// Implementation to find an employee by user ID
						employee = await this.findEmployee(user.id);
					} catch (error) {
						({ user, employee } = await this.registerWithEmployee(input, invite, languageCode));
					}
				}
			}

			// Whichever path found it, an ended employee is refused before its memberships change (outside the
			// find-or-register catch, so the refusal is not taken for a missing employee).
			assertEmployeeNotEnded(employee);

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
			if (registeredId) {
				await this.retireClaimAccount(registeredId);
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
	 * The account and employee of an ordinary invitation whose address has no account that can sign in: a new account
	 * and its employee, as before. An address that has one joins from that account's session instead (see
	 * {@link joinWithAccount}): one address keeps one account (ever-co/ever-gauzy#12143).
	 *
	 * @param input The user registration input and app integration config.
	 * @param invite The invitation being accepted.
	 * @param languageCode The language code for localization.
	 * @returns The new account and its employee in the invitation's organization.
	 */
	private async registerWithEmployee(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		invite: IInvite,
		languageCode: LanguagesEnum
	): Promise<{ user: IUser; employee: IEmployee }> {
		const user = await this.registerNewUser(input, invite, languageCode);
		const employee = await this.createEmployee(invite, user);
		return { user, employee };
	}

	/**
	 * The active account of the invited email in the invitation's tenant that the request's session belongs to, with
	 * its role, or null when the request has no session or the session is not one of the address's accounts.
	 *
	 * @param invite The invitation being accepted.
	 * @returns The session's account.
	 */
	private async findSessionAccount(invite: IInvite): Promise<IUser | null> {
		const sessionUserId = RequestContext.currentUserId();
		if (!sessionUserId) {
			return null;
		}

		const accounts = await this.accountsOf(invite);
		const own = accounts.filter(isActiveAccount).find((account) => account.id === sessionUserId);
		if (!own) {
			return null;
		}
		return await this.typeOrmUserRepository.findOne({
			where: { id: own.id },
			relations: { role: true }
		});
	}

	/**
	 * Joins an existing account to the invitation's organization: linked to it (an account of another organization of
	 * the tenant needs the link to switch to the one it joins), with its employee there or a new one. An ended employee
	 * there is refused before anything is written.
	 *
	 * @param invite The invitation being accepted.
	 * @param account The invitee's account.
	 * @returns The account and its employee in the invitation's organization.
	 */
	private async joinWithAccount(invite: IInvite, account: IUser): Promise<{ user: IUser; employee: IEmployee }> {
		const existing = await this.typeOrmEmployeeRepository.findOne({
			where: {
				userId: account.id,
				organizationId: invite.organizationId,
				tenantId: invite.tenantId
			}
		});
		assertEmployeeNotEnded(existing);

		await this.userOrganizationService.addUserToOrganization(account, invite.organizationId);
		const employee = existing ?? (await this.createEmployee(invite, account));
		return { user: account, employee };
	}

	/**
	 * The newest active account of the invited email in the invitation's tenant, whatever its role, with its role.
	 * A deactivated or archived account is left as it is.
	 *
	 * @param invite The invitation being accepted.
	 * @returns The account, or null when the email has no active account there.
	 */
	private async findActiveAccount(invite: IInvite): Promise<IUser | null> {
		const accounts = await this.accountsOf(invite);
		const active = accounts.filter(isActiveAccount);
		if (active.length === 0) {
			return null;
		}

		const [newest] = [...active].sort(newestFirst);
		return await this.typeOrmUserRepository.findOne({
			where: { id: newest.id },
			relations: { role: true }
		});
	}

	/**
	 * Retires the account a failed claim registered, as a merged placeholder's user is retired: deactivated, archived
	 * and soft-deleted, with its members and organization links. Only that account, told by the registration as soon
	 * as it was saved: never another one the same email gained meanwhile. Each write stands on its own, the account's
	 * first, so one that fails does not keep the others from being made, and the claim's own error stays the one
	 * reported. Not deleted: deleting a user makes the database check every table naming one.
	 *
	 * @param userId The account the claim registered.
	 */
	private async retireClaimAccount(userId: string): Promise<void> {
		const retired = { isActive: false, isArchived: true, deletedAt: new Date() };
		const { manager } = this.typeOrmUserRepository;
		const attempt = async (what: string, write: () => Promise<unknown>): Promise<boolean> => {
			try {
				await write();
				return true;
			} catch (cleanup) {
				console.error(`Failed to retire ${what} after a failed claim:`, cleanup);
				return false;
			}
		};
		// The account's write is the one the next acceptance depends on: tried again after a passing failure (a
		// deadlock, a dropped connection). A database that keeps refusing it leaves the account to an admin, who
		// merges the placeholder into that person's member as for any email that has an account.
		const accountRetired = await attempt(`the account ${userId}`, () =>
			triedAgain(() => manager.update(User, { id: userId }, retired))
		);
		if (!accountRetired) {
			// Still live, the account keeps its member and links: the person signs in with it, and an admin merges the
			// placeholder into that member (or files one for the account first, when the claim failed before making it).
			return;
		}
		await attempt(`the members of ${userId}`, () => manager.update(Employee, { userId }, retired));
		await attempt(`the organization links of ${userId}`, () =>
			manager.update(UserOrganization, { userId }, retired)
		);
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
		languageCode: LanguagesEnum,
		onSaved?: (user: IUser) => void
	): Promise<IUser> {
		const { id: organizationId, tenantId } = invite.organization;
		return await this.authService.register(
			{
				...input,
				user: { ...input.user, tenant: { id: tenantId } },
				organizationId,
				inviteId: invite.id
			},
			languageCode,
			onSaved
		);
	}

	/**
	 * Creates an employee based on the invite details and user information.
	 * @param invite The invite containing the organization details.
	 * @param user The user to be associated with the employee.
	 * @returns The created employee.
	 */
	private async createEmployee(invite: IInvite, user: IUser): Promise<IEmployee> {
		return await createInvitedEmployee(this.typeOrmEmployeeRepository, invite, invite.organization, user);
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
	 * Update employee memberships. A contact, department, team or project the employee is already an active member of
	 * is left as it is: an existing employee who accepts another invitation naming it gets no second membership row.
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
					if (members.some((member) => member.id === employee.id)) {
						return;
					}
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
					if (members.some((member) => member.id === employee.id)) {
						return;
					}
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
					if (members.some((member) => isActiveMembershipOf(member, employee))) {
						return;
					}

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
					if (members.some((member) => isActiveMembershipOf(member, employee))) {
						return;
					}

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
