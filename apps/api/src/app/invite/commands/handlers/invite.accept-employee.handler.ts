import { Invite, InviteStatusEnum } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AuthService } from '../../../auth';
import { EmployeeService } from '../../../employee/employee.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { getUserDummyImage } from '../../../core';

/**
 * Use this command for registering employees.
 * This command first registers a user, then creates an employee entry for the organization.
 * If the above two steps are successful, it finally sets the invitation status to accepted
 */
@CommandHandler(InviteAcceptEmployeeCommand)
export class InviteAcceptEmployeeHandler
	implements ICommandHandler<InviteAcceptEmployeeCommand> {
	constructor(
		private readonly inviteService: InviteService,
		private readonly employeeService: EmployeeService,
		private readonly authService: AuthService
	) {}

	public async execute(
		command: InviteAcceptEmployeeCommand
	): Promise<UpdateResult | Invite> {
		const { input } = command;

		if (!input.user.imageUrl) {
			input.user.imageUrl = getUserDummyImage(input.user);
		}

		const user = await this.authService.register(input);

		await this.employeeService.create({
			user,
			organization: input.organization
		});

		return await this.inviteService.update(input.inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}
}
