import { IUser } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { OrganizationService } from '../../../organization/organization.service';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';

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
		private readonly organizationService: OrganizationService
	) {}

	public async execute(command: InviteAcceptUserCommand): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite = await this.inviteService.findOneByIdString(inviteId);
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
			throw Error('Invite has already been accepted');
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
		} catch (error) {
			// Registration failed, so nothing consumed the invite after all — hand it back rather
			// than stranding it as ACCEPTED with no user attached.
			await this.inviteService.releaseInvite(inviteId);
			throw error;
		}

		const { id } = user;
		await this.inviteService.update(inviteId, {
			userId: id
		});

		return user;
	}
}
