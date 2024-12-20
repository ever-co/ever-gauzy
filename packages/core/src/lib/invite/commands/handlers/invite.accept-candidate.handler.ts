import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { IInvite, InviteStatusEnum, IUser, RolesEnum } from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptCandidateCommand } from '../invite.accept-candidate.command';
import { Candidate, User } from './../../../core/entities/internal';
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
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		@InjectRepository(User) private readonly typeOrmUserRepository: TypeOrmUserRepository,
		@InjectRepository(Candidate) private readonly typeOrmCandidateRepository: TypeOrmCandidateRepository
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

		let user: IUser;
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

		const { id } = user;
		await this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED,
			userId: id
		});

		return user;
	}
}
