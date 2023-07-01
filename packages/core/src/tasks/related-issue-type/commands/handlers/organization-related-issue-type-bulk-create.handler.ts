import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskRelatedIssueType } from '@gauzy/contracts';
import { OrganizationRelatedIssueTypeBulkCreateCommand } from '../organization-related-issue-type-bulk-create.command';
import { TaskRelatedIssueTypesService } from '../../related-issue-type.service';
import { TaskRelatedIssueTypes } from '../../related-issue-type.entity';

@CommandHandler(OrganizationRelatedIssueTypeBulkCreateCommand)
export class OrganizationRelatedIssueTypeBulkCreateHandler
	implements ICommandHandler<OrganizationRelatedIssueTypeBulkCreateCommand>
{
	constructor(
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypesService
	) {}

	public async execute(
		command: OrganizationRelatedIssueTypeBulkCreateCommand
	): Promise<ITaskRelatedIssueType[] | TaskRelatedIssueTypes[]> {
		const { input } = command;
		return await this.taskRelatedIssueTypeService.bulkCreateOrganizationRelatedIssueTypes(
			input
		);
	}
}
