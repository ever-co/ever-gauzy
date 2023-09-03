import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';
import { UserService } from '../../../user/user.service';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler
	implements ICommandHandler<AuthRegisterCommand> {
	constructor(
		private readonly authService: AuthService,
		private readonly userService: UserService
	) { }

	public async execute(command: AuthRegisterCommand): Promise<IUser> {
		const { input, languageCode } = command;
		if (
			input.user &&
			input.user.role &&
			input.user.role.name === RolesEnum.SUPER_ADMIN
		) {
			if (!input.createdById) {
				throw new BadRequestException()
			};

			const { role } = await this.userService.findOneByIdString(input.createdById, {
				relations: {
					role: true
				}
			})
			if (role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException();
			}
		}
		return await this.authService.register(input, languageCode);
	}
}
