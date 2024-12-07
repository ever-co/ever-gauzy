import { ICommand } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';

export class OrganizationTeamIssueTypeBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Team] Issue Type Bulk Create';

	constructor(public readonly input: IOrganizationTeam) {}
}
