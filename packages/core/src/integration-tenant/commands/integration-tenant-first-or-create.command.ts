import { ICommand } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { IIntegrationTenant, } from '@gauzy/contracts';
import { IntegrationTenant } from '../integration-tenant.entity';

export class IntegrationTenantFirstOrCreateCommand implements ICommand {
	static readonly type = '[Integration Tenant] First Or Create';

	constructor(
		public readonly options: FindOptionsWhere<IntegrationTenant>,
		public readonly input: IIntegrationTenant
	) { }
}
