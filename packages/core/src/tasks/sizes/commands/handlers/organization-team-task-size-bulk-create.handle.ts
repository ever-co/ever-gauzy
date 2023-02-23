import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { OrganizationTeamTaskSizeBulkCreateCommand } from '../organization-team-task-size-bulk-create.command';
import { TaskSizeService } from './../../size.service';

@CommandHandler(OrganizationTeamTaskSizeBulkCreateCommand)
export class OrganizationTeamTaskSizeBulkCreateHandler
	implements ICommandHandler<OrganizationTeamTaskSizeBulkCreateCommand> {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) { }

	public async execute(command: OrganizationTeamTaskSizeBulkCreateCommand): Promise<ITaskStatus[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk task size for specific organization team
		 */
		return await this.taskSizeService.createBulkSizesByEntity({ organizationId, organizationTeamId });
	}
}
