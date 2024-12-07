import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskPriority } from '@gauzy/contracts';
import { OrganizationProjectTaskPriorityBulkCreateCommand } from '../organization-project-task-priority-bulk-create.command';
import { TaskPriorityService } from '../../priority.service';

@CommandHandler(OrganizationProjectTaskPriorityBulkCreateCommand)
export class OrganizationProjectTaskPriorityBulkCreateHandler
	implements ICommandHandler<OrganizationProjectTaskPriorityBulkCreateCommand> {

	constructor(
		private readonly taskPriorityService: TaskPriorityService
	) { }

	public async execute(
		command: OrganizationProjectTaskPriorityBulkCreateCommand
	): Promise<ITaskPriority[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		// Create task priorities of the organization project.
		return await this.taskPriorityService.createBulkPrioritiesByEntity({ organizationId, projectId });
	}
}
