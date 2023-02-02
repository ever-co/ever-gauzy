import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { TenantStatusBulkCreateCommand } from './../tenant-status-bulk-create.command';
import { TaskStatusService } from './../../status.service';
import { TaskStatus } from './../../status.entity';

@CommandHandler(TenantStatusBulkCreateCommand)
export class TenantStatusBulkCreateHandler
	implements ICommandHandler<TenantStatusBulkCreateCommand> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) {}

	public async execute(command: TenantStatusBulkCreateCommand): Promise<ITaskStatus[] & TaskStatus[]> {
		const { tenants } = command;

		//1. Create statuses of the tenant.
		return await this.taskStatusService.bulkCreateTenantsStatus(tenants);
	}
}
