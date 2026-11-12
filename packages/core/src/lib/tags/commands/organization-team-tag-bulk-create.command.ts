import { ICommand } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';

/** Gives a team just created its starter labels (ever-co/ever-teams#5016). */
export class OrganizationTeamTagBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Team] Tag Bulk Create';

	constructor(public readonly input: IOrganizationTeam) {}
}
