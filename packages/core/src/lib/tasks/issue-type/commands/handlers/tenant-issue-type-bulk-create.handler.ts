import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIssueType } from '@gauzy/contracts';
import { TenantIssueTypeBulkCreateCommand } from '../tenant-issue-type-bulk-create.command';
import { IssueTypeService } from '../../issue-type.service';

@CommandHandler(TenantIssueTypeBulkCreateCommand)
export class TenantIssueTypeBulkCreateHandler implements ICommandHandler<TenantIssueTypeBulkCreateCommand> {

	constructor(
		private readonly issueTypeService: IssueTypeService
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: TenantIssueTypeBulkCreateCommand
	): Promise<IIssueType[]> {
		const { tenants } = command;
		// Create issue types of the tenant.
		return await this.issueTypeService.bulkCreateTenantsIssueTypes(tenants);
	}
}
