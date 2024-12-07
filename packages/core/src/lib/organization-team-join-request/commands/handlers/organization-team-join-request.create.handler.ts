import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationTeamJoinRequestService } from '../../organization-team-join-request.service';
import { OrganizationTeamJoinRequestCreateCommand } from '../organization-team-join-request.create.command';

@CommandHandler(OrganizationTeamJoinRequestCreateCommand)
export class OrganizationTeamJoinRequestCreateHandler implements ICommandHandler<OrganizationTeamJoinRequestCreateCommand> {

	constructor(
		private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService
	) { }

	public async execute(
		command: OrganizationTeamJoinRequestCreateCommand
	): Promise<Object> {
		try {
			const { input, languageCode } = command;
			await this._organizationTeamJoinRequestService.create(input, languageCode);
		} finally {
			return new Object({ status: HttpStatus.OK, message: `OK` });
		}
	}
}
