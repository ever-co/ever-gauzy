import { ICommand } from '@nestjs/cqrs';
import { IProcessTrackingDataInput } from '@gauzy/contracts';

/**
 * Command for bulk creation of custom tracking data
 */
export class CustomTrackingBulkCreateCommand implements ICommand {
	static readonly type = '[Custom Tracking] Bulk Create';

	constructor(
		public readonly input: IProcessTrackingDataInput[]
	) {}
}
