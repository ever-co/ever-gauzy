import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTeamJoinRequest } from '@gauzy/contracts';
import { OrganizationTeamJoinRequestService } from '../../organization-team-join-request.service';
import { OrganizationTeamJoinRequestCreateCommand } from '../organization-team-join-request.create.command';

@CommandHandler(OrganizationTeamJoinRequestCreateCommand)
export class OrganizationTeamJoinRequestCreateHandler implements ICommandHandler<OrganizationTeamJoinRequestCreateCommand> {

	constructor(
		private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService
	) { }

	public async execute(
		command: OrganizationTeamJoinRequestCreateCommand
	): Promise<IOrganizationTeamJoinRequest> {
		const { input, languageCode } = command;
		return await this._organizationTeamJoinRequestService.create(input, languageCode);
	}
}
