import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskSize } from '@gauzy/contracts';
import { OrganizationProjectTaskSizeBulkCreateCommand } from '../organization-project-task-size-bulk-create.command';
import { TaskSizeService } from '../../size.service';

@CommandHandler(OrganizationProjectTaskSizeBulkCreateCommand)
export class OrganizationTaskProjectSizeBulkCreateHandler
	implements ICommandHandler<OrganizationProjectTaskSizeBulkCreateCommand> {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) { }

	public async execute(
		command: OrganizationProjectTaskSizeBulkCreateCommand
	): Promise<ITaskSize[]> {
		const { input } = command;
		return await this.taskSizeService.bulkCreateOrganizationProjectSizes(input);
	}
}
