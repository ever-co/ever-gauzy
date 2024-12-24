import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIssueType } from '@gauzy/contracts';
import { OrganizationTeamIssueTypeBulkCreateCommand } from './../organization-team-issue-type-bulk-create.command';
import { IssueTypeService } from './../../issue-type.service';

@CommandHandler(OrganizationTeamIssueTypeBulkCreateCommand)
export class OrganizationTeamIssueTypeBulkCreateHandler
	implements ICommandHandler<OrganizationTeamIssueTypeBulkCreateCommand>
{
	constructor(private readonly issueTypeService: IssueTypeService) { }

	public async execute(
		command: OrganizationTeamIssueTypeBulkCreateCommand
	): Promise<IIssueType[]> {
		const { input } = command;
		const { id: organizationTeamId, organizationId } = input;

		/**
		 * Create bulk issue types for specific organization team
		 */
		return await this.issueTypeService.createBulkIssueTypeByEntity({
			organizationId,
			organizationTeamId,
		});
	}
}
