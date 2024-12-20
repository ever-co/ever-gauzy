import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskRelatedIssueType } from '@gauzy/contracts';
import { OrganizationProjectRelatedIssueTypeBulkCreateCommand } from '../organization-project-related-issue-type-bulk-create.command';
import { TaskRelatedIssueTypeService } from '../../related-issue-type.service';
import { TaskRelatedIssueType } from '../../related-issue-type.entity';

@CommandHandler(OrganizationProjectRelatedIssueTypeBulkCreateCommand)
export class OrganizationProjectRelatedIssueTypeBulkCreateHandler
	implements
	ICommandHandler<OrganizationProjectRelatedIssueTypeBulkCreateCommand>
{
	constructor(
		private readonly TaskRelatedIssueTypeervice: TaskRelatedIssueTypeService
	) { }

	public async execute(
		command: OrganizationProjectRelatedIssueTypeBulkCreateCommand
	): Promise<ITaskRelatedIssueType[] & TaskRelatedIssueType[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		/**
		 * Create bulk task Related Issue Type for specific organization project
		 */
		return await this.TaskRelatedIssueTypeervice.createBulkRelatedIssueTypesByEntity(
			{
				organizationId,
				projectId,
			}
		);
	}
}
