import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskVersion } from '@gauzy/contracts';
import { OrganizationTeamTaskVersionBulkCreateCommand } from '../organization-team-task-version-bulk-create.command';
import { TaskVersionService } from '../../version.service';

@CommandHandler(OrganizationTeamTaskVersionBulkCreateCommand)
export class OrganizationTeamTaskVersionBulkCreateHandler
	implements ICommandHandler<OrganizationTeamTaskVersionBulkCreateCommand>
{
	constructor(private readonly taskVersionService: TaskVersionService) {}

	public async execute(command: OrganizationTeamTaskVersionBulkCreateCommand): Promise<ITaskVersion[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk task Versions for specific organization team
		 */
		return this.taskVersionService.createBulkVersionsByEntity({
			organizationId,
			organizationTeamId
		});
	}
}
