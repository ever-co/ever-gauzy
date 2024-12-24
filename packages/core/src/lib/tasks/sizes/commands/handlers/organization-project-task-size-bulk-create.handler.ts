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
		const { id: projectId, organizationId } = input;

		/**
		 * Create bulk task size for specific organization team
		 */
		return await this.taskSizeService.createBulkSizesByEntity({ organizationId, projectId });
	}
}
