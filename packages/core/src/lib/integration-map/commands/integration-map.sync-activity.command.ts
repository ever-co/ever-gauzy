import { ICommand } from '@nestjs/cqrs';
import { IActivity, IIntegrationMapSyncEntity } from '@gauzy/contracts';

export class IntegrationMapSyncActivityCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Activity';

	constructor(
		public readonly input: IIntegrationMapSyncEntity<IActivity>
	) { }
}
