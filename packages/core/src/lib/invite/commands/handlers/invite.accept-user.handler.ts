import { InviteStatusEnum, IUser } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { OrganizationService } from '../../../organization/organization.service';
import { User } from './../../../core/entities/internal';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';

/**
 * Use this command for registering all non-employee users.
 * This command first registers a user, then creates a user_organization relation.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptUserCommand)
export class InviteAcceptUserHandler implements ICommandHandler<InviteAcceptUserCommand> {

	constructor(
		@InjectRepository(User)
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly organizationService: OrganizationService
	) { }

	public async execute(
		command: InviteAcceptUserCommand
	): Promise<IUser> {
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

		let user: IUser;
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

		const { id } = user;
		await this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED,
			userId: id
		});

		return user;
	}
}
