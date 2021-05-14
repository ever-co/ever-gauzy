import { IOrganization } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ReportOrganizationCreateCommand implements ICommand {
	static readonly type = '[Report] Organization Create';

	constructor(public readonly input: IOrganization) {}
}