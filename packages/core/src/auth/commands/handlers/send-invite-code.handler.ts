import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendInviteCodeCommand } from '../send-invite-code.command';
import { AuthService } from '../../auth.service';

@CommandHandler(SendInviteCodeCommand)
export class SendInviteCodeHandler implements ICommandHandler<SendInviteCodeCommand> {

	constructor(
		private readonly authService: AuthService
	) {}

	public async execute(command: SendInviteCodeCommand): Promise<any> {
		try {
			const { input } = command;
			const { email } = input;

			await this.authService.sendInviteCode(email);
		} finally {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}
}
