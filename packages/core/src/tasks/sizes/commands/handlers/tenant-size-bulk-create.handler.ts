import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskSize } from '@gauzy/contracts';
import { TenantSizeBulkCreateCommand } from '../tenant-size-bulk-create.command';
import { TaskSizeService } from '../../size.service';

@CommandHandler(TenantSizeBulkCreateCommand)
export class TenantSizeBulkCreateHandler
	implements ICommandHandler<TenantSizeBulkCreateCommand> {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) { }

	public async execute(command: TenantSizeBulkCreateCommand): Promise<ITaskSize[]> {
		const { tenants } = command;

		//1. Create task sizes of the tenant.
		return await this.taskSizeService.bulkCreateTenantsTaskSizes(tenants);
	}
}
