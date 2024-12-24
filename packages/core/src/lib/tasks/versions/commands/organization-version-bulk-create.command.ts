import { ICommand } from '@nestjs/cqrs';
import { IOrganization } from '@gauzy/contracts';

export class OrganizationVersionBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Version] Bulk Create';

	constructor(public readonly input: IOrganization) {}
}
