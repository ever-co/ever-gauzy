import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
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

		// Creating a SUPER_ADMIN is reserved to callers who may edit super admins — the same boundary
		// the register handler and invite creation enforce. Both the flat `roleId` and the `role`
		// relation are resolved from the database (the relation wins on persist), and an id that does
		// not belong to the caller's tenant is refused rather than ignored.
		await this.userService.assertCanAssignRoles([input?.roleId, input?.role?.id]);

		return await this.userService.create(input);
	}
}
