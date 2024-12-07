import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { UserDeleteCommand } from './../user.delete.command';
import { UserService } from './../../user.service';

@CommandHandler(UserDeleteCommand)
export class UserDeleteHandler implements ICommandHandler<UserDeleteCommand> {

	constructor(
		private readonly userService: UserService
	) { }

	public async execute(command: UserDeleteCommand): Promise<DeleteResult> {
		try {
			let { userId } = command;
			return await this.userService.delete(userId);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
