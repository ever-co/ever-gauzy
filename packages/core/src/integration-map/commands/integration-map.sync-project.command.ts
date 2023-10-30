import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncEntity, IOrganizationProjectCreateInput, IOrganizationProjectUpdateInput } from '@gauzy/contracts';

export class IntegrationMapSyncProjectCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Project';

	constructor(
		public readonly input: IIntegrationMapSyncEntity<IOrganizationProjectCreateInput | IOrganizationProjectUpdateInput>
	) { }
}
