import { IIntegrationMapSyncTimeLog } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class IntegrationMapSyncTimeLogCommand implements ICommand {
	static readonly type = '[Integration Map] Sync TimeLog';

	constructor(
		public readonly input: IIntegrationMapSyncTimeLog
	) {}
}
