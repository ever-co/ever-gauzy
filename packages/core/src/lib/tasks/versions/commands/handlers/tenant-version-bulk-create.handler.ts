import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskVersion } from '@gauzy/contracts';
import { TenantVersionBulkCreateCommand } from '../tenant-version-bulk-create.command';
import { TaskVersionService } from '../../version.service';
import { TaskVersion } from '../../version.entity';

@CommandHandler(TenantVersionBulkCreateCommand)
export class TenantVersionBulkCreateHandler implements ICommandHandler<TenantVersionBulkCreateCommand> {
	constructor(private readonly taskVersionService: TaskVersionService) {}

	public async execute(command: TenantVersionBulkCreateCommand): Promise<ITaskVersion[] & TaskVersion[]> {
		const { tenants } = command;

		//1. Create Versions of the tenant.
		return await this.taskVersionService.bulkCreateTenantsVersions(tenants);
	}
}
