import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectModuleCreateInput } from '@gauzy/contracts';

export class OrganizationProjectModuleCreateCommand implements ICommand {
	static readonly type = '[OrganizationProjectModule] Create Module';

	constructor(public readonly input: IOrganizationProjectModuleCreateInput) {}
}
