import { ICommand } from '@nestjs/cqrs';
import { ID, IOrganizationProjectModuleUpdateInput } from '@gauzy/contracts';

export class OrganizationProjectModuleUpdateCommand implements ICommand {
	static readonly type = '[OrganizationProjectModule] Update Module';

	constructor(public readonly id: ID, public readonly input: IOrganizationProjectModuleUpdateInput) {}
}
