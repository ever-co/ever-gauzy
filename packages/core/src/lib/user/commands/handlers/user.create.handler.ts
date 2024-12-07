import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUser } from '@gauzy/contracts';
import { UserCreateCommand } from '../user.create.command';
import { UserService } from '../../user.service';

@CommandHandler(UserCreateCommand)
export class UserCreateHandler implements ICommandHandler<UserCreateCommand> {
	constructor(private readonly userService: UserService) {}

	/**
	 * Executes the user creation command by calling the UserService to create a new user.
	 *
	 * @param command The UserCreateCommand containing user creation input.
	 * @returns A Promise resolving to the created IUser object.
	 */
	public async execute(command: UserCreateCommand): Promise<IUser> {
		const { input } = command;
		return await this.userService.create(input);
	}
}
