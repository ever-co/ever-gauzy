import { ICommand } from '@nestjs/cqrs';
import { IProcessTrackingDataInput } from '@gauzy/contracts';

export class ProcessTrackingDataCommand implements ICommand {
	static readonly type = '[Custom Tracking] Process Tracking Data';

	constructor(public readonly input: IProcessTrackingDataInput) {}
}
