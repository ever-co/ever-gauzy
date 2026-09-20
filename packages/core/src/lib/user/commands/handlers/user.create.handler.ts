import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID, IUser, IUserCreateInput } from '@gauzy/contracts';
import { UserCreateCommand } from '../user.create.command';
import { UserService } from '../../user.service';
import { normalizeRolePayload } from '../../role-assignment.helper';

@CommandHandler(UserCreateCommand)
export class UserCreateHandler implements ICommandHandler<UserCreateCommand> {
	private readonly logger = new Logger(UserCreateHandler.name);

	constructor(private readonly userService: UserService) {}

	/**
	 * Executes the user creation command by calling the UserService to create a new user.
	 *
	 * @param command The UserCreateCommand containing user creation input.
	 * @returns A Promise resolving to the created IUser object.
	 */
	public async execute(command: UserCreateCommand): Promise<IUser> {
		const { id, ...input } = (command.input ?? {}) as IUserCreateInput & { id?: ID };

		// A create never adopts an existing row. `CrudService.create()` upserts when the payload carries
		// a primary key, so a body id turned "create a user" into "overwrite that user": POST /candidate
		// and POST /employee hash the body `password` into the payload, so `user: { id: <an admin of my
		// tenant> }` reset that account's password and demoted its role — a takeover the tenant check
		// cannot see, since the victim is a member of the caller's own tenant (GHSA-jh6m-9fxr-rx3c).
		// Every caller of this command means to INSERT a user, so the id is dropped rather than refused.
		if (id) {
			this.logger.warn(`Ignoring the body-supplied user id on a create: ${id}`);
		}

		// Every form of the role — `roleId`, `role` as a bare id string, `role: { id }` — is read, and
		// the payload is pinned to that single id so the role that is checked is the role that is
		// saved (GHSA-x4mv-fhwj-g3rp). A malformed role key, or a `role`/`roleId` pair that disagrees,
		// is a 400.
		normalizeRolePayload(input);

		// Creating a SUPER_ADMIN is reserved to callers who may edit super admins — the same boundary
		// the register handler and invite creation enforce. The role is resolved from the database, and
		// an id that does not belong to the caller's tenant is refused rather than ignored.
		await this.userService.assertCanAssignRoles(input);

		return await this.userService.create(input);
	}
}
