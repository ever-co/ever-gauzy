import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { OrganizationStatusBulkCreateCommand } from './../organization-status-bulk-create.command';
import { TaskStatusService } from './../../status.service';
import { TaskStatus } from './../../status.entity';

@CommandHandler(OrganizationStatusBulkCreateCommand)
export class OrganizationStatusBulkCreateHandler
	implements ICommandHandler<OrganizationStatusBulkCreateCommand> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) {}

	public async execute(command: OrganizationStatusBulkCreateCommand): Promise<ITaskStatus[] | TaskStatus[]> {
		const { input } = command;
		return await this.taskStatusService.bulkCreateOrganizationStatus(input);
	}
}
