import { IEvent } from '@nestjs/cqrs';
import { IEmployeeNotificationCreateInput } from '@gauzy/contracts';

export class EmployeeCreateNotificationEvent implements IEvent {
	constructor(public readonly input: IEmployeeNotificationCreateInput) {}
}
