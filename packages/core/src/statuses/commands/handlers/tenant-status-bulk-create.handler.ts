import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IStatus } from '@gauzy/contracts';
import { TenantStatusBulkCreateCommand } from './../tenant-status-bulk-create.command';
import { StatusService } from './../../status.service';
import { Status } from './../../status.entity';

@CommandHandler(TenantStatusBulkCreateCommand)
export class TenantStatusBulkCreateHandler
	implements ICommandHandler<TenantStatusBulkCreateCommand> {

	constructor(
		private readonly statusService: StatusService
	) {}

	public async execute(command: TenantStatusBulkCreateCommand): Promise<IStatus[] & Status[]> {
		const { tenants } = command;

		//1. Create statuses of the tenant.
		return await this.statusService.bulkCreateTenantsStatus(tenants);
	}
}
