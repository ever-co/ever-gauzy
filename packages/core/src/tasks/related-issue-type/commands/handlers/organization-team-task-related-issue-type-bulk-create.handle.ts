import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskRelatedIssueType } from '@gauzy/contracts';
import { OrganizationTeamTaskRelatedIssueTypeBulkCreateCommand } from '../organization-team-task-related-issue-type-bulk-create.command';
import { TaskRelatedIssueTypesService } from '../../related-issue-type.service';

@CommandHandler(OrganizationTeamTaskRelatedIssueTypeBulkCreateCommand)
export class OrganizationTeamTaskRelatedIssueTypeBulkCreateHandler
	implements
		ICommandHandler<OrganizationTeamTaskRelatedIssueTypeBulkCreateCommand>
{
	constructor(
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypesService
	) {}

	public async execute(
		command: OrganizationTeamTaskRelatedIssueTypeBulkCreateCommand
	): Promise<ITaskRelatedIssueType[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk task statuses for specific organization team
		 */
		return this.taskRelatedIssueTypeService.createBulkRelatedIssueTypesByEntity(
			{
				organizationId,
				organizationTeamId,
			}
		);
	}
}
