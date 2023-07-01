import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskRelatedIssueType } from '@gauzy/contracts';
import { OrganizationProjectRelatedIssueTypeBulkCreateCommand } from '../organization-project-related-issue-type-bulk-create.command';
import { TaskRelatedIssueTypesService } from '../../related-issue-type.service';
import { TaskRelatedIssueTypes } from '../../related-issue-type.entity';

@CommandHandler(OrganizationProjectRelatedIssueTypeBulkCreateCommand)
export class OrganizationProjectRelatedIssueTypeBulkCreateHandler
	implements
		ICommandHandler<OrganizationProjectRelatedIssueTypeBulkCreateCommand>
{
	constructor(
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypesService
	) {}

	public async execute(
		command: OrganizationProjectRelatedIssueTypeBulkCreateCommand
	): Promise<ITaskRelatedIssueType[] & TaskRelatedIssueTypes[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		/**
		 * Create bulk task Related Issue Type for specific organization project
		 */
		return await this.taskRelatedIssueTypeService.createBulkRelatedIssueTypesByEntity(
			{
				organizationId,
				projectId,
			}
		);
	}
}
