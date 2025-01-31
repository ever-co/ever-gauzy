import { IEvent } from '@nestjs/cqrs';
import { IUserNotificationCreateInput } from '@gauzy/contracts';

export class UserNotificationEvent implements IEvent {
	constructor(public readonly input: IUserNotificationCreateInput) {}
}
