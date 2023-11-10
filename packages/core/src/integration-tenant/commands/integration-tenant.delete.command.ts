import { ICommand } from '@nestjs/cqrs';
import { IIntegrationTenant, IIntegrationTenantFindInput } from '@gauzy/contracts';

export class IntegrationTenantDeleteCommand implements ICommand {
    static readonly type = '[Integration] Delete Integration';

    constructor(
        public readonly id: IIntegrationTenant['id'],
        public readonly options: IIntegrationTenantFindInput
    ) { }
}
