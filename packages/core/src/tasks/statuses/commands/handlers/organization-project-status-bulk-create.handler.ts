import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IStatus } from '@gauzy/contracts';
import { OrganizationProjectStatusBulkCreateCommand } from './../organization-project-status-bulk-create.command';
import { StatusService } from './../../status.service';
import { TaskStatus } from './../../status.entity';

@CommandHandler(OrganizationProjectStatusBulkCreateCommand)
export class OrganizationProjectStatusBulkCreateHandler
	implements ICommandHandler<OrganizationProjectStatusBulkCreateCommand> {

	constructor(
		private readonly statusService: StatusService
	) {}

	public async execute(command: OrganizationProjectStatusBulkCreateCommand): Promise<IStatus[] & TaskStatus[]> {
		const { input } = command;
		return await this.statusService.bulkCreateOrganizationProjectStatus(input);
	}
}
