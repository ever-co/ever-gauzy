import { IEvent } from '@nestjs/cqrs';
import { ISubscriptionCreateInput } from '@gauzy/contracts';

export class CreateSubscriptionEvent implements IEvent {
	constructor(public readonly input: ISubscriptionCreateInput) {}
}
