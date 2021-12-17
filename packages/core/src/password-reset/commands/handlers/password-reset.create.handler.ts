import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PasswordResetCreateCommand } from './../password-reset.create.command';
import { PasswordResetService } from './../../password-reset.service';

@CommandHandler(PasswordResetCreateCommand)
export class PasswordResetCreateHandler
	implements ICommandHandler<PasswordResetCreateCommand> {
	
	constructor(
		private readonly _passwordResetService : PasswordResetService
	) {}

	public async execute(
		command: PasswordResetCreateCommand
	) {
		const { input } = command;
		const { email, token } = input;

		try {
			return await this._passwordResetService.create({
				email,
				token
			});
		} catch (error) {
			
		}
	}
}
