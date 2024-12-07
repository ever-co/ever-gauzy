import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskPriority } from '@gauzy/contracts';
import { TenantTaskPriorityBulkCreateCommand } from '../tenant-task-priority-bulk-create.command';
import { TaskPriorityService } from '../../priority.service';

@CommandHandler(TenantTaskPriorityBulkCreateCommand)
export class TenantTaskPriorityBulkCreateHandler
	implements ICommandHandler<TenantTaskPriorityBulkCreateCommand> {

	constructor(
		private readonly taskPriorityService: TaskPriorityService
	) { }

	public async execute(
		command: TenantTaskPriorityBulkCreateCommand
	): Promise<ITaskPriority[]> {
		const { tenants } = command;

		// Create task priorities of the tenant.
		return await this.taskPriorityService.bulkCreateTenantsTaskPriorities(tenants);
	}
}
