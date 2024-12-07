import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PasswordResetCreateCommand } from './../password-reset.create.command';
import { PasswordResetService } from './../../password-reset.service';

@CommandHandler(PasswordResetCreateCommand)
export class PasswordResetCreateHandler implements ICommandHandler<PasswordResetCreateCommand> {
	constructor(private readonly _passwordResetService: PasswordResetService) {}

	/**
	 * Execute a command to create a password reset request.
	 *
	 * @param {PasswordResetCreateCommand} command - The command object containing information for password reset creation.
	 * @returns {Promise<any>} A Promise that resolves to the result of the password reset creation process or rejects with a BadRequestException in case of an error.
	 */
	public async execute(command: PasswordResetCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const { email, token, tenantId } = input;

			return await this._passwordResetService.create({
				email,
				tenantId,
				token
			});
		} catch (error) {
			throw new BadRequestException('Forgot password request failed!');
		}
	}
}
