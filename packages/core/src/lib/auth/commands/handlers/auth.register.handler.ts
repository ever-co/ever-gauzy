import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { IRole, IUser, RolesEnum } from '@gauzy/contracts';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';
import { getORMType, MultiORMEnum } from '../../../core/utils';
import { RequestContext } from '../../../core/context';
import { UserService } from '../../../user/user.service';
import { TypeOrmRoleRepository } from '../../../role/repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from '../../../role/repository/mikro-orm-role.repository';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler implements ICommandHandler<AuthRegisterCommand> {
	constructor(
		private readonly authService: AuthService,
		private readonly userService: UserService,
		private readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		private readonly mikroOrmRoleRepository: MikroOrmRoleRepository
	) {}

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
		let targetRoleName: string | null = null;

		if (input.user?.role?.name) {
			// Role name provided directly via role object
			targetRoleName = input.user.role.name;
		} else if (input.user?.roleId) {
			// Get tenant id from request context
			const tenantId = RequestContext.currentTenantId();

			// Only roleId provided — resolve it to a role entity to get the name
			try {
				let role: IRole;
				switch (getORMType()) {
					case MultiORMEnum.MikroORM:
						role = await this.mikroOrmRoleRepository.findOneOrFail({
							id: input.user.roleId,
							...(tenantId ? { tenantId } : {})
						});
						break;
					case MultiORMEnum.TypeORM:
						role = await this.typeOrmRoleRepository.findOneByOrFail({
							id: input.user.roleId,
							...(tenantId ? { tenantId } : {})
						});
						break;
					default:
						throw new Error(`Not implemented for ${getORMType()}`);
				}

				if (!role) {
					throw new BadRequestException('The specified roleId does not reference a valid role.');
				}

				targetRoleName = role.name;
			} catch {
				throw new BadRequestException('The specified roleId does not reference a valid role.');
			}
		}

		// Check if the target role is SUPER_ADMIN and require 'createdByUserId' for verification
		if (targetRoleName === RolesEnum.SUPER_ADMIN) {
			if (!input.createdByUserId) {
				throw new BadRequestException('Missing createdByUserId for SUPER_ADMIN registration.');
			}

			// Fetch role details of the creator
			const { role } = await this.userService.findOneByIdString(input.createdByUserId, {
				relations: { role: true }
			});

			// Verify if the creator's role is SUPER_ADMIN
			if (role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException('Only SUPER_ADMIN can register other SUPER_ADMIN users.');
			}
		}

		// Register the user using the AuthService
		return await this.authService.register(input, languageCode);
	}
}
