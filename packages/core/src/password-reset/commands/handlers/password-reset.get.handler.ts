import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PasswordResetGetCommand } from './../password-reset.get.command';
import { PasswordResetService } from './../../password-reset.service';
import { IPasswordReset } from '@gauzy/contracts';

@CommandHandler(PasswordResetGetCommand)
export class PasswordResetGetHandler
	implements ICommandHandler<PasswordResetGetCommand> {
	
	constructor(
		private readonly _passwordResetService : PasswordResetService
	) {}

	public async execute(
		command: PasswordResetGetCommand
	): Promise<IPasswordReset> {
		const { input } = command;
		const { token } = input;

		try {
			return await this._passwordResetService.findOneByConditions({
				token
			}, {
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			throw new NotFoundException(error);
		}
	}
}
