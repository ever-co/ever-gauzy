import { IEvent } from '@nestjs/cqrs';
import { IEntitySubscriptionCreateInput } from '@gauzy/contracts';

export class CreateSubscriptionEvent implements IEvent {
	constructor(public readonly input: IEntitySubscriptionCreateInput) {}
}
