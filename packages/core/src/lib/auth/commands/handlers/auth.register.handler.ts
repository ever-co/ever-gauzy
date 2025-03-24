import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';
import { UserService } from '../../../user/user.service';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler implements ICommandHandler<AuthRegisterCommand> {
	constructor(private readonly authService: AuthService, private readonly userService: UserService) {}

	/**
	 * Executes the user registration command, handling specific checks for SUPER_ADMIN role.
	 *
	 * @param command The AuthRegisterCommand containing user registration input and optional parameters.
	 * @returns A Promise resolving to the registered IUser object.
	 * @throws BadRequestException if input is missing required fields.
	 * @throws UnauthorizedException if the user initiating registration is not authorized.
	 */
	public async execute(command: AuthRegisterCommand): Promise<IUser> {
		const { input, languageCode } = command;

		// Check if the user role is SUPER_ADMIN and require 'createdById' for verification
		if (input.user?.role?.name === RolesEnum.SUPER_ADMIN) {
			if (!input.createdById) {
				throw new BadRequestException('Missing createdById for SUPER_ADMIN registration.');
			}

			// Fetch role details of the creator
			const { role } = await this.userService.findOneByIdString(input.createdById, {
				relations: { role: true }
			});

			// Verify if the creator's role is SUPER_ADMIN
			if (role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException('Only SUPER_ADMIN can register other SUPER_ADMIN users.');
			}
		}

		// Register the user using the AuthService
		return await this.authService.autoRegister(input, languageCode);
	}
}
