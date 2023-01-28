import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskPriority } from '@gauzy/contracts';
import { OrganizationProjectPriorityBulkCreateCommand } from '../organization-project-priority-bulk-create.command';
import { TaskPriorityService } from '../../priority.service';

@CommandHandler(OrganizationProjectPriorityBulkCreateCommand)
export class OrganizationProjectPriorityBulkCreateHandler
	implements ICommandHandler<OrganizationProjectPriorityBulkCreateCommand> {

	constructor(
		private readonly taskPriorityService: TaskPriorityService
	) {}

	public async execute(
		command: OrganizationProjectPriorityBulkCreateCommand
	): Promise<ITaskPriority[]> {
		const { input } = command;
		return await this.taskPriorityService.bulkCreateOrganizationProjectPriority(input);
	}
}
