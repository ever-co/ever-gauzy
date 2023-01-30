import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskSize } from '@gauzy/contracts';
import { TenantTaskSizeBulkCreateCommand } from '../tenant-task-size-bulk-create.command';
import { TaskSizeService } from '../../size.service';

@CommandHandler(TenantTaskSizeBulkCreateCommand)
export class TenantTaskSizeBulkCreateHandler
	implements ICommandHandler<TenantTaskSizeBulkCreateCommand> {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) { }

	public async execute(command: TenantTaskSizeBulkCreateCommand): Promise<ITaskSize[]> {
		const { tenants } = command;

		//1. Create task sizes of the tenant.
		return await this.taskSizeService.bulkCreateTenantsTaskSizes(tenants);
	}
}
