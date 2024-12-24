import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { OrganizationTeamTaskStatusBulkCreateCommand } from './../organization-team-task-status-bulk-create.command';
import { TaskStatusService } from './../../status.service';

@CommandHandler(OrganizationTeamTaskStatusBulkCreateCommand)
export class OrganizationTeamTaskStatusBulkCreateHandler
	implements ICommandHandler<OrganizationTeamTaskStatusBulkCreateCommand> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) { }

	public async execute(command: OrganizationTeamTaskStatusBulkCreateCommand): Promise<ITaskStatus[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk task statuses for specific organization team
		 */
		return this.taskStatusService.createBulkStatusesByEntity({ organizationId, organizationTeamId });
	}
}
