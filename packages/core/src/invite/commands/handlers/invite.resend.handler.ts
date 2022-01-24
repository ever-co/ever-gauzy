import { IInvite, InviteStatusEnum } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { InviteService } from '../../invite.service';
import { InviteResendCommand } from '../invite.resend.command';

@CommandHandler(InviteResendCommand)
export class InviteResendHandler
	implements ICommandHandler<InviteResendCommand> {
	constructor(private readonly inviteService: InviteService) {}

	public async execute(
		command: InviteResendCommand
	): Promise<UpdateResult | IInvite> {
		const { input , languageCode } = command;
		const { invitedById } = input;

		const expireDate = new Date();
		expireDate.setDate(expireDate.getDate() + 7);

		console.log(input)
		console.log(languageCode)

		return await this.inviteService.resendEmail(input, invitedById, languageCode);
	}
}
