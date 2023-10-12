import { IHubstaffTimeSlotActivity, IIntegrationMapSyncEntity } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class IntegrationMapSyncTimeSlotCommand implements ICommand {
	static readonly type = '[Integration Map] Sync TimeSlot';

	constructor(
		public readonly input: IIntegrationMapSyncEntity<IHubstaffTimeSlotActivity>
	) { }
}
