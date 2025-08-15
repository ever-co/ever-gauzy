import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { IInvite, InviteStatusEnum } from '@gauzy/contracts';
import { InviteRejectCommand } from '../invite-reject.command';
import { InviteService } from '../../invite.service';

/**
 * Reject invite handler
 */
@CommandHandler(InviteRejectCommand)
export class InviteRejectHandler implements ICommandHandler<InviteRejectCommand> {
	constructor(private readonly inviteService: InviteService) {}

	/**
	 * Reject invite
	 * @param command - The command containing the invite rejection data.
	 * @returns The rejected invite.
	 */
	async execute(command: InviteRejectCommand): Promise<IInvite | UpdateResult> {
		const { input } = command;
		const { email, token, code } = input;

		if (!email) {
			throw new BadRequestException('Email is required');
		}
		if (!token && !code) {
			throw new BadRequestException('Either token or code must be provided');
		}

		try {
			let invite: IInvite;

			// Validate invite by token or code
			if (token) {
				invite = await this.inviteService.validateByToken({ email, token });
			} else if (code) {
				invite = await this.inviteService.validateByCode({ email, code });
			}

			if (!invite) {
				throw new NotFoundException('Invite does not exist');
			}
			return await this.inviteService.update(invite.id, { status: InviteStatusEnum.REJECTED });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
