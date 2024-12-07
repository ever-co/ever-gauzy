import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskPriority } from '@gauzy/contracts';
import { OrganizationTaskPriorityBulkCreateCommand } from '../organization-task-priority-bulk-create.command';
import { TaskPriorityService } from './../../priority.service';

@CommandHandler(OrganizationTaskPriorityBulkCreateCommand)
export class OrganizationTaskPriorityBulkCreateHandler
	implements ICommandHandler<OrganizationTaskPriorityBulkCreateCommand> {

	constructor(
		private readonly taskPriorityService: TaskPriorityService
	) { }

	public async execute(
		command: OrganizationTaskPriorityBulkCreateCommand
	): Promise<ITaskPriority[]> {
		const { input } = command;

		// Create task priorities of the organization.
		return await this.taskPriorityService.bulkCreateOrganizationTaskPriorities(input);
	}
}
