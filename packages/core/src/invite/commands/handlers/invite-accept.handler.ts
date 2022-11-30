import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IInvite, IUser, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { AuthService } from './../../../auth/auth.service';
import { UserService } from './../../../user/user.service';
import { InviteService } from './../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { InviteAcceptCommand } from '../invite-accept.command';
import { User } from './../../../core/entities/internal';

@CommandHandler(InviteAcceptCommand)
export class InviteAcceptHandler
	implements ICommandHandler<InviteAcceptCommand> {

	constructor(
		@InjectRepository(User) private readonly userRepository: Repository<User>,

		private readonly commandBus: CommandBus,
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly userService: UserService,
	) {}

	public async execute(command: InviteAcceptCommand) {
		try {
			const { input, languageCode } = command;
			const { email, token, code } = input;

			let invite: IInvite;
			if (typeof input === 'object' && 'email' in input && 'token' in input) {
				invite = await this.inviteService.validate({
					email,
					token
				});
			} else if (typeof input === 'object' && 'email' in input && 'code' in input) {
				invite = await this.inviteService.validateByCode({
					email,
					code
				});
			}
			if (!invite) {
				throw Error('Invite does not exist');
			}
			/**
			 * Assign role to user
			 */
			const { id: inviteId } = invite;
			const { role } = await this.inviteService.findOneByIdString(inviteId, {
				relations: {
					role: true
				}
			});
			input['user']['role'] = role;
			input['inviteId'] = inviteId;

			/**
			 * Invite accept for employee & user
			 */
			let user: IUser;
			switch (role.name) {
				case RolesEnum.EMPLOYEE:
					user = await this.commandBus.execute(
						new InviteAcceptEmployeeCommand(input, languageCode)
					);
					return this._authorizeUser(user);
				default:
					user = await this.commandBus.execute(
						new InviteAcceptUserCommand(input, languageCode)
					);
					return this._authorizeUser(user);
			}
		} catch (error) {
			throw new BadRequestException();
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
			await this.userRepository.findOneOrFail({
				where: {
					id,
					email
				},
				relations: {
					employee: true,
					role: {
						rolePermissions: true
					}
				},
				order: {
					createdAt: 'DESC'
				}
			});
			// If users are inactive
			if (user.isActive === false) {
				throw new UnauthorizedException();
			}
			// If employees are inactive
			if (isNotEmpty(user.employee) && user.employee.isActive === false) {
				throw new UnauthorizedException();
			}

			const access_token = await this.authService.getJwtAccessToken(user);
			const refresh_token = await this.authService.getJwtRefreshToken(user);

			await this.userService.setCurrentRefreshToken(refresh_token, user.id);

			return new Object({
				user,
				token: access_token,
				refresh_token: refresh_token
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
