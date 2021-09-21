import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@gauzy/config';
import { UserDeleteCommand } from './../user.delete.command';
import { UserService } from './../../user.service';
import { ForbiddenException } from '@nestjs/common';

@CommandHandler(UserDeleteCommand)
export class UserDeleteHandler
	implements ICommandHandler<UserDeleteCommand> {

	constructor(
		private readonly userService: UserService,
		private readonly configService: ConfigService
	) {}

	public async execute(command: UserDeleteCommand): Promise<any> {
		const { userId } = command;
		if (this.configService.get('demo') === true) {
            throw new ForbiddenException();
        }
		return await this.userService.delete(userId);
	}
}
