import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { InviteService } from './../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { InviteAcceptCommand } from '../invite-accept.command';


@CommandHandler(InviteAcceptCommand)
export class InviteAcceptHandler
	implements ICommandHandler<InviteAcceptCommand> {

	constructor(
		private readonly commandBus: CommandBus,
		private readonly inviteService: InviteService
	) {}

	public async execute(command: InviteAcceptCommand) {
		try {
			const { input, languageCode } = command;
			const { email, token } = input;

			const invite = await this.inviteService.validate({
				email,
				token
			});
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
			switch (role.name) {
				case RolesEnum.EMPLOYEE:
					return await this.commandBus.execute(
						new InviteAcceptEmployeeCommand(input, languageCode)
					);
				default:
					return this.commandBus.execute(
						new InviteAcceptUserCommand(input, languageCode)
					);
			}
		} catch (error) {
			throw new BadRequestException();
		}
	}
}
