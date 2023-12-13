import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncEntity, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';

export class IntegrationMapSyncTaskCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Task';

	constructor(
		public readonly input: IIntegrationMapSyncEntity<ITaskCreateInput | ITaskUpdateInput>,
		public readonly triggeredEvent: boolean = true // Enabled the "2 Way Sync Triggered Event" Synchronization
	) { }
}
