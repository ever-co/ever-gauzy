import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIssueType } from '@gauzy/contracts';
import { OrganizationProjectIssueTypeBulkCreateCommand } from '../organization-project-issue-type-bulk-create.command';
import { IssueTypeService } from '../../issue-type.service';

@CommandHandler(OrganizationProjectIssueTypeBulkCreateCommand)
export class OrganizationProjectIssueTypeBulkCreateHandler
	implements ICommandHandler<OrganizationProjectIssueTypeBulkCreateCommand>
{
	constructor(private readonly issueTypeService: IssueTypeService) {}

	public async execute(
		command: OrganizationProjectIssueTypeBulkCreateCommand
	): Promise<IIssueType[]> {
		const { input } = command;
		const { id: projectId, organizationId } = input;

		// Create issue types of the organization project.
		return await this.issueTypeService.createBulkIssueTypeByEntity({
			organizationId,
			projectId,
		});
	}
}
