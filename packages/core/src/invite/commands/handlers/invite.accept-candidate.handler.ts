import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IInvite,
	InviteStatusEnum,
	IUser,
	RolesEnum
} from '@gauzy/contracts';
import { AuthService } from '../../../auth/auth.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptCandidateCommand } from '../invite.accept-candidate.command';
import {
	Candidate,
	Organization,
	User
} from './../../../core/entities/internal'
import { BadRequestException } from '@nestjs/common';

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
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Organization) private readonly organizationRepository: Repository<Organization>,
		@InjectRepository(Candidate) private readonly candidateRepository: Repository<Candidate>
	) {}

	public async execute(
		command: InviteAcceptCandidateCommand
	): Promise<IUser> {
		const { input, languageCode } = command;
		const { inviteId } = input;

		const invite: IInvite = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				departments: {
					candidates: true
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

		let user: IUser;
		try {
			const { tenantId, email } = invite;
			user = await this.userRepository.findOneOrFail({
				where: {
					email,
					tenantId,
					role: {
						name: RolesEnum.CANDIDATE
					}
				},
				relations: {
					candidate: true
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			/**
			 * User register after accept invitation
			 */
			user = await this.authService.register(
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
			try {
				/**
				 * Create candidate after create user
				 */
				const create = this.candidateRepository.create({
					user,
					organization,
					tenantId,
					appliedDate: invite.actionDate || null,
					organizationDepartments: invite.departments || []
				});
				await this.candidateRepository.save(create);
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
