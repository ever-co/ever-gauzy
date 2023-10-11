import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncEntity, IOrganizationProject } from '@gauzy/contracts';

export class IntegrationMapSyncProjectCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Project';

	constructor(
		public readonly input: IIntegrationMapSyncEntity<IOrganizationProject>
	) { }
}
