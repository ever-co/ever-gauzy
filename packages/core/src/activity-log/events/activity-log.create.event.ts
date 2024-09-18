import { IActivityLogCreateInput } from '@gauzy/contracts';
import { IEvent } from '@nestjs/cqrs';

export class ActivityLogCreateEvent implements IEvent {
	constructor(public readonly input: IActivityLogCreateInput) {}
}
