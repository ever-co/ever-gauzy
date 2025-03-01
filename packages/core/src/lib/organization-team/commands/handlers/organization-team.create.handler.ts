import { BadRequestException, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { OrganizationTeamCreateCommand } from '../organization-team.create.command';
import { OrganizationTeamService } from './../../organization-team.service';
import { OrganizationTeamTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationTeamTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationTeamTaskStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationTeamIssueTypeBulkCreateCommand } from './../../../tasks/issue-type/commands';

@CommandHandler(OrganizationTeamCreateCommand)
export class OrganizationTeamCreateHandler implements ICommandHandler<OrganizationTeamCreateCommand> {
	private readonly logger = new Logger(OrganizationTeamCreateHandler.name);

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationTeamService: OrganizationTeamService
	) {}

	/**
	 * Handles the creation of an organization team and initiates related background tasks.
	 *
	 * @param command - The command containing the input data for creating the team.
	 * @returns The created organization team.
	 */
	public async execute(command: OrganizationTeamCreateCommand): Promise<IOrganizationTeam> {
		try {
			const { input } = command;
			const team = await this._organizationTeamService.create(input);

			// Execute related commands in the background
			this.executeBackgroundTasks(team);

			return team;
		} catch (error) {
			this.logger.error('Error while creating organization team', error.stack);
			throw new BadRequestException(`Error while creating organization team: ${error.message}`);
		}
	}

	/**
	 * Executes related commands concurrently in the background.
	 *
	 * @param team - The organization team for which to execute the commands.
	 */
	private async executeBackgroundTasks(team: IOrganizationTeam): Promise<void> {
		try {
			const commands = [
				new OrganizationTeamTaskStatusBulkCreateCommand(team),
				new OrganizationTeamTaskPriorityBulkCreateCommand(team),
				new OrganizationTeamTaskSizeBulkCreateCommand(team),
				new OrganizationTeamIssueTypeBulkCreateCommand(team)
			];

			await Promise.all(commands.map((command) => this._commandBus.execute(command)));
		} catch (error) {
			console.log('Error while executing background tasks:', error);
		}
	}
}
