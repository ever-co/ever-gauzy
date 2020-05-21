import { ICommand } from '@nestjs/cqrs';
import { IIntegrationTenantCreateDto } from '@gauzy/models';

export class IntegrationTenantCreateCommand implements ICommand {
	static readonly type = '[Integration] Create Integration';

	constructor(public readonly input: IIntegrationTenantCreateDto) {}
}
