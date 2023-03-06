import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmailResetCreateCommand } from '../email-reset.create.command';
import { EmailResetService } from './../../email-reset.service';

@CommandHandler(EmailResetCreateCommand)
export class EmailResetCreateHandler
	implements ICommandHandler<EmailResetCreateCommand> {
	
	constructor(
		private readonly _emailResetService : EmailResetService
	) {}

	public async execute(
		command: EmailResetCreateCommand
	) {
		const { input } = command;
		const { oldEmail, newEmail, token, code } = input;

		try {
			return await this._emailResetService.create({
				oldEmail,
				newEmail,
				token,
				code
			});
		} catch (error) {
			
		}
	}
}
