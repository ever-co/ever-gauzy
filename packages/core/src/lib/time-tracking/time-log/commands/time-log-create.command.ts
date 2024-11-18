import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from './../time-log.entity';

export class TimeLogCreateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log create';

	constructor(public readonly input: Partial<TimeLog>) {}
}
