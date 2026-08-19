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

		// The target role may arrive as `roleId` or as a `role` object; resolve BOTH from the DATABASE.
		// A client-supplied `role.name` must never feed the SUPER_ADMIN gate below (a role object with
		// only an id, or a spoofed name, used to skip it), and checking only the first of the two is not
		// enough either: the `role` RELATION wins over the flat `roleId` when the row is persisted
		// (AuthService.register pins roleId = role.id), so a body pairing a harmless `roleId` with a
		// privileged `role: { id }` would be validated as the harmless one and registered as the
		// privileged one.
		const targetRoleIds = [input.user?.roleId, input.user?.role?.id].filter((roleId) => !!roleId);
		if (input.user?.role && !targetRoleIds.length) {
			throw new BadRequestException('The specified role does not reference a valid role.');
		}

		if (targetRoleIds.length) {
			// Get tenant id from request context
			const tenantId = RequestContext.currentTenantId();

			for (const targetRoleId of targetRoleIds) {
				// Resolve role entity to get the name
				try {
					const whereCondition = {
						id: targetRoleId,
						...(tenantId ? { tenantId } : {})
					};

					const role: IRole =
						getORMType() === MultiORMEnum.MikroORM
							? await this.mikroOrmRoleRepository.findOneOrFail(whereCondition)
							: await this.typeOrmRoleRepository.findOneByOrFail(whereCondition);

					// The strictest of the candidates decides: if ANY of them is SUPER_ADMIN, the creator
					// check below must run.
					if (role.name === RolesEnum.SUPER_ADMIN || !targetRoleName) {
						targetRoleName = role.name;
					}
				} catch {
					throw new BadRequestException('The specified roleId does not reference a valid role.');
				}
			}
		}

		// Check if the target role is SUPER_ADMIN and require 'createdByUserId' for verification
		if (targetRoleName === RolesEnum.SUPER_ADMIN) {
			if (!input.createdByUserId) {
				throw new BadRequestException('Missing createdByUserId for SUPER_ADMIN registration.');
			}

			const createdByUserId = input.createdByUserId;

			// Fetch role details of the creator
			const { role } = await this.userService.findOneByIdString(createdByUserId, { relations: { role: true } });

			// Verify if the creator's role is SUPER_ADMIN
			if (role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException('Only SUPER_ADMIN can register other SUPER_ADMIN users.');
			}
		}

		// Register the user using the AuthService
		return await this.authService.register(input, languageCode);
	}
}
