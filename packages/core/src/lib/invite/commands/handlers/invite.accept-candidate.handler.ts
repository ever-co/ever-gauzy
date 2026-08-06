import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IInvite, IUser, RolesEnum } from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptCandidateCommand } from '../invite.accept-candidate.command';
import { TypeOrmUserRepository } from '../../../user/repository/type-orm-user.repository';
import { TypeOrmCandidateRepository } from '../../../candidate/repository/type-orm-candidate.repository';

/**
 * Use this command for registering candidates.
 * This command first registers a user, then creates an candidate entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptCandidateCommand)
export class InviteAcceptCandidateHandler implements ICommandHandler<InviteAcceptCandidateCommand> {
	constructor(
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly typeOrmCandidateRepository: TypeOrmCandidateRepository,
		private readonly inviteService: InviteService,
		private readonly authService: AuthService
	) {}

	public async execute(command: InviteAcceptCandidateCommand): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite: IInvite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				departments: {
					candidates: true
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

		// Claim the invite BEFORE registering anyone — see InviteService.claimInvite. Everything
		// above is a read, so two parallel acceptances are both still live at this point.
		if (!(await this.inviteService.claimInvite(inviteId))) {
			throw Error('Invite has already been accepted');
		}

		let user: IUser;
		try {
			// Inner try/catch is find-or-register control flow, not error handling.
			try {
				const { tenantId, email } = invite;

				user = await this.typeOrmUserRepository.findOneOrFail({
					where: {
						email,
						tenantId,
						role: {
							name: RolesEnum.CANDIDATE
						}
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
				try {
					/**
					 * Create candidate after create user
					 */
					const create = this.typeOrmCandidateRepository.create({
						user,
						organization,
						tenantId,
						appliedDate: invite.actionDate || null,
						organizationDepartments: invite.departments || []
					});
					await this.typeOrmCandidateRepository.save(create);
				} catch (error) {
					throw new BadRequestException(error);
				}
			}
		} catch (error) {
			// Nothing consumed the invite after all — hand it back rather than stranding it as
			// ACCEPTED with no candidate attached.
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
