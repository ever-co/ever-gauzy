import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TenantStatusBulkCreateCommand } from './../tenant-status-bulk-create.command';
import { StatusService } from './../../status.service';

@CommandHandler(TenantStatusBulkCreateCommand)
export class TenantStatusBulkCreateHandler
	implements ICommandHandler<TenantStatusBulkCreateCommand> {

	constructor(
		private readonly statusService: StatusService
	) {}

	public async execute(
		command: TenantStatusBulkCreateCommand
	) {
		const { tenants } = command;
		console.log(tenants);
	}
}
