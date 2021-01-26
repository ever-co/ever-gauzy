import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserCreateCommand } from '../user.create.command';
import { UserService } from '../../user.service';
import { IUser } from '@gauzy/contracts';

@CommandHandler(UserCreateCommand)
export class UserCreateHandler implements ICommandHandler<UserCreateCommand> {
	constructor(private readonly userService: UserService) {}

	public async execute(command: UserCreateCommand): Promise<IUser> {
		const { input } = command;

		return await this.userService.create(input);
	}
}
