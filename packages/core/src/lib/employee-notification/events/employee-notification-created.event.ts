import { IEvent } from '@nestjs/cqrs';
import { IEmployeeNotification } from '@gauzy/contracts';

/**
 * Published on the CQRS bus by `EmployeeNotificationService.create` once a notification row exists — as opposed to
 * `EmployeeCreateNotificationEvent`, which asks for one to be created and carries no id.
 *
 * It is the fact the Inbox plugin files as an inbox item (the unified inbox), and the real-time channel turns
 * into an addressed hint. A notification the receiver switched off never produces it.
 */
export class EmployeeNotificationCreatedEvent implements IEvent {
	constructor(public readonly notification: IEmployeeNotification) {}
}
