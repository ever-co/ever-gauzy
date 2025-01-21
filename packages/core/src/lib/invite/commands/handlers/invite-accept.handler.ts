import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { IInvite, IUser, RolesEnum } from '@gauzy/contracts';
import { AuthService } from './../../../auth/auth.service';
import { UserService } from './../../../user/user.service';
import { EmployeeService } from './../../../employee/employee.service';
import { InviteService } from './../../invite.service';
import { InviteAcceptCandidateCommand } from '../invite.accept-candidate.command';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { InviteAcceptCommand } from '../invite-accept.command';
import { User } from './../../../core/entities/internal';
import { TypeOrmUserRepository } from './../../../user/repository/type-orm-user.repository';

@CommandHandler(InviteAcceptCommand)
export class InviteAcceptHandler implements ICommandHandler<InviteAcceptCommand> {
	constructor(
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly commandBus: CommandBus,
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly userService: UserService,
		private readonly employeeService: EmployeeService
	) {}

	/**
	 * Accepts an invitation based on the provided command.
	 * @param command The command containing the invite acceptance data.
	 * @returns The authorized user.
	 */
	public async execute(command: InviteAcceptCommand) {
		try {
			const { input, languageCode } = command;
			const { email, token, code } = input;

			let invite: IInvite;

			// Validate invite by token or code
			if (typeof input === 'object' && 'email' in input && 'token' in input) {
				invite = await this.inviteService.validateByToken({ email, token });
			} else if (typeof input === 'object' && 'email' in input && 'code' in input) {
				invite = await this.inviteService.validateByCode({ email, code });
			}
			if (!invite) {
				throw Error('Invite does not exist');
			}

			// Assign role to user
			const { id: inviteId } = invite;
			const { role } = await this.inviteService.findOneByIdString(inviteId, {
				relations: { role: true }
			});
			input['user']['role'] = role;
			input['inviteId'] = inviteId;

			// Invite accept for employee, candidate & user
			let user: IUser;
			switch (role.name) {
				case RolesEnum.EMPLOYEE:
					user = await this.commandBus.execute(new InviteAcceptEmployeeCommand(input, languageCode));
					return await this._authorizeUser(user);
				case RolesEnum.CANDIDATE:
					user = await this.commandBus.execute(new InviteAcceptCandidateCommand(input, languageCode));
					return await this._authorizeUser(user);
				default:
					user = await this.commandBus.execute(new InviteAcceptUserCommand(input, languageCode));
					return await this._authorizeUser(user);
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * After accept invite authorize user
	 *
	 * @param user
	 * @returns
	 */
	private async _authorizeUser(user: IUser): Promise<Object> {
		try {
			const { id, email } = user;
			await this.typeOrmUserRepository.findOneOrFail({
				where: {
					id,
					email,
					isActive: true,
					isArchived: false
				},
				relations: {
					role: { rolePermissions: true }
				},
				order: { createdAt: 'DESC' }
			});

			// If users are inactive
			if (user.isActive === false) {
				throw new UnauthorizedException();
			}

			// Retrieve the employee details associated with the user.
			const employee = await this.employeeService.findOneByUserId(user.id);

			// Check if the employee is active and not archived. If not, throw an error.
			if (employee && (!employee.isActive || employee.isArchived)) {
				throw new UnauthorizedException();
			}

			// Generate both access and refresh tokens concurrently for efficiency.
			const [access_token, refresh_token] = await Promise.all([
				this.authService.getJwtAccessToken(user),
				this.authService.getJwtRefreshToken(user)
			]);

			// Store the current refresh token with the user for later validation.
			await this.userService.setCurrentRefreshToken(refresh_token, user.id);

			// Return the user object with user details, tokens, and optionally employee info if it exists.
			return {
				user: new User({
					...user,
					...(employee && { employee })
				}),
				token: access_token,
				refresh_token: refresh_token
			};
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
