import { ICommand } from '@nestjs/cqrs';
import { ID, IIntegrationTenantUpdateInput } from '@gauzy/contracts';

export class IntegrationTenantUpdateCommand implements ICommand {
	static readonly type = '[Integration] Update Integration';

	constructor(public readonly id: ID, public readonly input: IIntegrationTenantUpdateInput) {}
}
