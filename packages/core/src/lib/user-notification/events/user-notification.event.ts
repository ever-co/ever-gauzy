import { IEvent } from '@nestjs/cqrs';
import { IUserNotificationCreateInput } from '@gauzy/contracts';

export class UserCreateNotificationEvent implements IEvent {
	constructor(public readonly input: IUserNotificationCreateInput) {}
}
