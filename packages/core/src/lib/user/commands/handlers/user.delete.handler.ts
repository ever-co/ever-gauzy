import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { UserDeleteCommand } from './../user.delete.command';
import { UserService } from './../../user.service';

@CommandHandler(UserDeleteCommand)
export class UserDeleteHandler implements ICommandHandler<UserDeleteCommand> {

	constructor(private readonly userService: UserService) { }

	/**
	 * Executes the `UserDeleteCommand` to delete a user by ID.
	 *
	 * @param command - The `UserDeleteCommand` containing the ID of the user to delete.
	 * @returns A promise resolving to the `DeleteResult` of the operation.
	 * @throws ForbiddenException if the deletion fails.
	 */
	public async execute(command: UserDeleteCommand): Promise<DeleteResult> {
		const { userId } = command;

		try {
			// Attempt to delete the user by ID
			return await this.userService.delete(userId);
		} catch (error) {
			// Handle errors and throw a ForbiddenException for unauthorized operations
			throw new ForbiddenException('You are not allowed to delete this user.');
		}
	}
}
