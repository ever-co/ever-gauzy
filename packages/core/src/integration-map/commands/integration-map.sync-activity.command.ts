import { IIntegrationMapSyncActivity } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class IntegrationMapSyncActivityCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Activity';

	constructor(
		public readonly input: IIntegrationMapSyncActivity
	) {}
}
