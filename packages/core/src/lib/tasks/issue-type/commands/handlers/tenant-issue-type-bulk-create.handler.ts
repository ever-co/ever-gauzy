import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIssueType } from '@gauzy/contracts';
import { TenantIssueTypeBulkCreateCommand } from '../tenant-issue-type-bulk-create.command';
import { IssueTypeService } from '../../issue-type.service';

@CommandHandler(TenantIssueTypeBulkCreateCommand)
export class TenantIssueTypeBulkCreateHandler implements ICommandHandler<TenantIssueTypeBulkCreateCommand> {
	constructor(private readonly issueTypeService: IssueTypeService) {}

	/**
	 * Executes the command to create default issue types for multiple tenants.
	 *
	 * This handler receives the `TenantIssueTypeBulkCreateCommand`
	 * and delegates the creation of issue types to the IssueTypeService.
	 *
	 * @param command The command containing tenants for which issue types should be created
	 * @returns Promise resolving to an array of created issue types
	 */
	public async execute(command: TenantIssueTypeBulkCreateCommand): Promise<IIssueType[]> {
		return await this.issueTypeService.bulkCreateTenantsIssueTypes(command.tenants);
	}
}
