import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { OrganizationTeamCreateCommand } from '../organization-team.create.command';
import { OrganizationTeamService } from './../../organization-team.service';
import { OrganizationTeamTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationTeamTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationTeamTaskStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationTeamIssueTypeBulkCreateCommand } from './../../../tasks/issue-type/commands';

@CommandHandler(OrganizationTeamCreateCommand)
export class OrganizationTeamCreateHandler
	implements ICommandHandler<OrganizationTeamCreateCommand>
{
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationTeamService: OrganizationTeamService
	) {}

	public async execute(
		command: OrganizationTeamCreateCommand
	): Promise<IOrganizationTeam> {
		try {
			const { input } = command;
			const team = await this._organizationTeamService.create(input);

			// 1. Create task statuses for relative organization team.
			this._commandBus.execute(
				new OrganizationTeamTaskStatusBulkCreateCommand(team)
			);

			// 2. Create task priorities for relative organization team.
			this._commandBus.execute(
				new OrganizationTeamTaskPriorityBulkCreateCommand(team)
			);

			// 3. Create task sizes for relative organization team.
			this._commandBus.execute(
				new OrganizationTeamTaskSizeBulkCreateCommand(team)
			);

			// 4. Create issue types for relative organization team.
			this._commandBus.execute(
				new OrganizationTeamIssueTypeBulkCreateCommand(team)
			);

			return team;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
