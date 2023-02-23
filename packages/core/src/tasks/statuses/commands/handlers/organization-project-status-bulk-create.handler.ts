import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskStatus } from '@gauzy/contracts';
import { OrganizationProjectStatusBulkCreateCommand } from './../organization-project-status-bulk-create.command';
import { TaskStatusService } from './../../status.service';
import { TaskStatus } from './../../status.entity';

@CommandHandler(OrganizationProjectStatusBulkCreateCommand)
export class OrganizationProjectStatusBulkCreateHandler
	implements ICommandHandler<OrganizationProjectStatusBulkCreateCommand> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) { }

	public async execute(command: OrganizationProjectStatusBulkCreateCommand): Promise<ITaskStatus[] & TaskStatus[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		/**
		 * Create bulk task statuses for specific organization project
		 */
		return await this.taskStatusService.createBulkStatusesByEntity({ organizationId, projectId });
	}
}
