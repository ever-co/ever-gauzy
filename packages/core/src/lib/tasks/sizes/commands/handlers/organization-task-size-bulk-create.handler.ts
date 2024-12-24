import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskSize } from '@gauzy/contracts';
import { OrganizationTaskSizeBulkCreateCommand } from '../organization-task-size-bulk-create.command';
import { TaskSizeService } from './../../size.service';

@CommandHandler(OrganizationTaskSizeBulkCreateCommand)
export class OrganizationTaskSizeBulkCreateHandler
	implements ICommandHandler<OrganizationTaskSizeBulkCreateCommand> {

	constructor(
		private readonly taskStatusService: TaskSizeService
	) { }

	public async execute(command: OrganizationTaskSizeBulkCreateCommand): Promise<ITaskSize[]> {
		const { input } = command;

		// Create task sizes of the organization.
		return await this.taskStatusService.bulkCreateOrganizationTaskSizes(input);
	}
}
