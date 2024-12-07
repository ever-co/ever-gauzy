import { IEvent } from '@nestjs/cqrs';
import { IActivityLogInput } from '@gauzy/contracts';

export class ActivityLogEvent implements IEvent {
	constructor(public readonly input: IActivityLogInput) {}
}
