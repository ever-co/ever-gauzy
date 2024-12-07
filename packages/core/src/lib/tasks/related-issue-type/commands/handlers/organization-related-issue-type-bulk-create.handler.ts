import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskRelatedIssueType } from '@gauzy/contracts';
import { OrganizationRelatedIssueTypeBulkCreateCommand } from '../organization-related-issue-type-bulk-create.command';
import { TaskRelatedIssueTypeService } from '../../related-issue-type.service';
import { TaskRelatedIssueType } from '../../related-issue-type.entity';

@CommandHandler(OrganizationRelatedIssueTypeBulkCreateCommand)
export class OrganizationRelatedIssueTypeBulkCreateHandler
	implements ICommandHandler<OrganizationRelatedIssueTypeBulkCreateCommand>
{
	constructor(
		private readonly TaskRelatedIssueTypeervice: TaskRelatedIssueTypeService
	) { }

	public async execute(
		command: OrganizationRelatedIssueTypeBulkCreateCommand
	): Promise<ITaskRelatedIssueType[] | TaskRelatedIssueType[]> {
		const { input } = command;
		return await this.TaskRelatedIssueTypeervice.bulkCreateOrganizationRelatedIssueTypes(
			input
		);
	}
}
