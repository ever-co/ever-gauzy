import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IPasswordReset } from '@gauzy/contracts';
import { PasswordResetGetCommand } from './../password-reset.get.command';
import { PasswordResetService } from './../../password-reset.service';

@CommandHandler(PasswordResetGetCommand)
export class PasswordResetGetHandler implements ICommandHandler<PasswordResetGetCommand> {
	constructor(private readonly _passwordResetService: PasswordResetService) {}

	/**
	 * Executes the PasswordResetGetCommand to retrieve a password reset entry.
	 *
	 * This method searches for a password reset entry based on the provided token and returns the latest entry (sorted by createdAt in descending order).
	 *
	 * - If the token is found, the corresponding password reset entry is returned.
	 * - If no matching token is found, a NotFoundException is thrown.
	 *
	 * @param {PasswordResetGetCommand} command - The command containing the input data, specifically the token for the password reset request.
	 * @returns {Promise<IPasswordReset>} - A promise that resolves to the matching password reset entry.
	 * @throws {NotFoundException} - If no password reset entry is found for the provided token.
	 */
	public async execute(command: PasswordResetGetCommand): Promise<IPasswordReset> {
		try {
			// Extract the token from the command input
			const { token } = command.input;

			// Find the password reset entry using the token
			return await this._passwordResetService.findOneByOptions({
				where: { token, isActive: true, isArchived: false },
				order: { createdAt: 'DESC' }
			});
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Forgot password request failed!`, HttpStatus.BAD_REQUEST);
		}
	}
}
