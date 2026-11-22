import { ConflictException } from '@nestjs/common';
import { IEmployee, IInvite, IOrganization, IOrganizationTeam, IUser } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { OrganizationService } from '../../../organization/organization.service';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../../../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { createInvitedEmployee } from '../../invited-employee';

/**
 * Use this command for registering all non-employee users.
 * This command first registers a user, then creates a user_organization relation.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptUserCommand)
export class InviteAcceptUserHandler implements ICommandHandler<InviteAcceptUserCommand> {
	constructor(
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly organizationService: OrganizationService,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		private readonly userOrganizationService: UserOrganizationService
	) {}

	public async execute(command: InviteAcceptUserCommand): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite = await this.inviteService.findOneByIdString(inviteId, { relations: { teams: true } });
		if (!invite) {
			throw Error('Invite does not exist');
		}

		const organization = await this.organizationService.findOneByIdString(invite.organizationId);
		if (!organization.invitesAllowed) {
			throw Error('Organization no longer allows invites');
		}

		// Claim the invite BEFORE registering anyone. Everything above this line is a read, so two
		// parallel acceptances of the same invite are still both live here; the conditional flip to
		// ACCEPTED is what picks a single winner. Marking the invite accepted only at the end — as
		// this handler used to — meant both racers passed validation and both ran a full
		// registration off one invite.
		if (!(await this.inviteService.claimInvite(inviteId))) {
			throw new ConflictException('Invite has already been accepted');
		}

		let user: IUser;
		try {
			// Inner try/catch is find-or-register control flow, not error handling: a missing user
			// is the signal to create one.
			try {
				const { tenantId, email } = invite;
				user = await this.typeOrmUserRepository.findOneOrFail({
					where: {
						email,
						tenantId
					},
					order: {
						createdAt: 'DESC'
					}
				});
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
						organizationId,
						inviteId
					},
					languageCode
				);
			}

			await this.joinInvitedTeams(invite, organization, user);
		} catch (error) {
			// Registration or joining the invitation's teams failed, so nothing consumed the invite
			// after all — hand it back rather than stranding it as ACCEPTED with no user attached.
			await this.inviteService.releaseInvite(inviteId);
			throw error;
		}

		const { id } = user;
		await this.inviteService.update(inviteId, {
			userId: id
		});

		return user;
	}

	/**
	 * Makes the invitee a member of the teams the invitation names, whatever role it grants: a team's members are
	 * employees of its organization, so an Admin or Manager invited to a team gets an employee there, as an Employee
	 * invitee does (ever-co/ever-gauzy#12128). An invitation that names no team, as the user invitations of Gauzy's
	 * own Users page, gives an account only.
	 *
	 * @param invite The invitation being accepted, with its teams.
	 * @param organization The invitation's organization.
	 * @param user The invitee's account.
	 */
	private async joinInvitedTeams(invite: IInvite, organization: IOrganization, user: IUser): Promise<void> {
		const teams = invite.teams ?? [];
		if (teams.length === 0) {
			return;
		}

		await this.linkToOrganization(invite, user);
		const employee = await this.findOrCreateEmployee(invite, organization, user);
		await this.addToTeams(invite, employee, teams);
	}

	/**
	 * Links the account to the invitation's organization. A registration made the link already; an existing account of
	 * another organization of the tenant lacks it, and without it cannot switch to the organization it joins.
	 *
	 * @param invite The invitation being accepted.
	 * @param user The invitee's account.
	 */
	private async linkToOrganization(invite: IInvite, user: IUser): Promise<void> {
		const account = await this.typeOrmUserRepository.findOneOrFail({
			where: { id: user.id },
			relations: { role: true }
		});
		await this.userOrganizationService.addUserToOrganization(account, invite.organizationId);
	}

	/**
	 * The invitee's employee in the invitation's organization: the one the account already has there, or a new one.
	 *
	 * @param invite The invitation being accepted.
	 * @param organization The invitation's organization.
	 * @param user The invitee's account.
	 * @returns The employee.
	 */
	private async findOrCreateEmployee(invite: IInvite, organization: IOrganization, user: IUser): Promise<IEmployee> {
		const existing = await this.typeOrmEmployeeRepository.findOne({
			where: {
				userId: user.id,
				organizationId: invite.organizationId,
				tenantId: invite.tenantId
			}
		});
		if (existing) {
			return existing;
		}

		return await createInvitedEmployee(this.typeOrmEmployeeRepository, invite, organization, user);
	}

	/**
	 * Adds the employee to each team of the invitation it is not a member of yet.
	 *
	 * @param invite The invitation being accepted.
	 * @param employee The invitee's employee in the invitation's organization.
	 * @param teams The teams the invitation names.
	 */
	private async addToTeams(invite: IInvite, employee: IEmployee, teams: IOrganizationTeam[]): Promise<void> {
		const memberships = await this.typeOrmOrganizationTeamEmployeeRepository.find({
			where: { employeeId: employee.id }
		});
		const joinedTeamIds = new Set(memberships.map(({ organizationTeamId }) => organizationTeamId));
		const teamsToJoin = teams.filter(({ id }) => !joinedTeamIds.has(id));

		const newMemberships = teamsToJoin.map(({ id: organizationTeamId }) =>
			this.typeOrmOrganizationTeamEmployeeRepository.create({
				employeeId: employee.id,
				organizationTeamId,
				organizationId: invite.organizationId,
				tenantId: invite.tenantId
			})
		);
		await this.typeOrmOrganizationTeamEmployeeRepository.save(newMemberships);
	}
}
