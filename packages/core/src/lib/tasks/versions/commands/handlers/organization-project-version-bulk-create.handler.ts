import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskVersion } from '@gauzy/contracts';
import { OrganizationProjectVersionBulkCreateCommand } from '../organization-project-version-bulk-create.command';
import { TaskVersionService } from '../../version.service';
import { TaskVersion } from '../../version.entity';

@CommandHandler(OrganizationProjectVersionBulkCreateCommand)
export class OrganizationProjectVersionBulkCreateHandler
	implements ICommandHandler<OrganizationProjectVersionBulkCreateCommand>
{
	constructor(private readonly taskVersionService: TaskVersionService) {}

	public async execute(
		command: OrganizationProjectVersionBulkCreateCommand
	): Promise<ITaskVersion[] & TaskVersion[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		/**
		 * Create bulk task versions for specific organization project
		 */
		return await this.taskVersionService.createBulkVersionsByEntity({
			organizationId,
			projectId
		});
	}
}
