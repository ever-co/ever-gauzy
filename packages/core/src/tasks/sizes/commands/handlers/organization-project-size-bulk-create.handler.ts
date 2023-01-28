import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskPriority } from '@gauzy/contracts';
import { OrganizationProjectSizeBulkCreateCommand } from '../organization-project-size-bulk-create.command';
import { TaskSizeService } from '../../size.service';

@CommandHandler(OrganizationProjectSizeBulkCreateCommand)
export class OrganizationProjectSizeBulkCreateHandler
	implements ICommandHandler<OrganizationProjectSizeBulkCreateCommand> {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) { }

	public async execute(
		command: OrganizationProjectSizeBulkCreateCommand
	): Promise<ITaskPriority[]> {
		const { input } = command;
		return await this.taskSizeService.bulkCreateOrganizationProjectSize(input);
	}
}
