import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { OrganizationTeamTaskPriorityBulkCreateCommand } from '../organization-team-task-priority-bulk-create.command';
import { TaskPriorityService } from './../../priority.service';

@CommandHandler(OrganizationTeamTaskPriorityBulkCreateCommand)
export class OrganizationTeamTaskPriorityBulkCreateHandler
	implements ICommandHandler<OrganizationTeamTaskPriorityBulkCreateCommand> {

	constructor(
		private readonly taskPriorityService: TaskPriorityService
	) { }

	public async execute(command: OrganizationTeamTaskPriorityBulkCreateCommand): Promise<ITaskStatus[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk task priority for specific organization team
		 */
		return await this.taskPriorityService.createBulkPrioritiesByEntity({ organizationId, organizationTeamId });
	}
}
