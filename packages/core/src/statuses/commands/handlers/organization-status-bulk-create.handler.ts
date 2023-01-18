import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IStatus } from '@gauzy/contracts';
import { OrganizationStatusBulkCreateCommand } from './../organization-status-bulk-create.command';
import { StatusService } from './../../status.service';
import { Status } from './../../status.entity';

@CommandHandler(OrganizationStatusBulkCreateCommand)
export class OrganizationStatusBulkCreateHandler
	implements ICommandHandler<OrganizationStatusBulkCreateCommand> {

	constructor(
		private readonly statusService: StatusService
	) {}

	public async execute(command: OrganizationStatusBulkCreateCommand): Promise<IStatus[] | Status[]> {
		const { input } = command;
		return await this.statusService.bulkCreateOrganizationStatus(input);
	}
}
