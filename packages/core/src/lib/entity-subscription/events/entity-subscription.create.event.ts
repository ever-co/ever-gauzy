import { IEvent } from '@nestjs/cqrs';
import { IEntitySubscriptionCreateInput } from '@gauzy/contracts';

export class CreateEntitySubscriptionEvent implements IEvent {
	constructor(readonly input: IEntitySubscriptionCreateInput) {}
}
