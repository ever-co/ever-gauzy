import { IEvent } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

/** The read / archive state a notification update stated. */
export interface IEmployeeNotificationStateChange {
	tenantId: ID;
	/** The receiver whose notifications changed. */
	receiverEmployeeId?: ID | null;
	/** The notification ids the change concerns, or `'all'` for the receiver's every unread one (mark-all-read). */
	ids: ID[] | 'all';
	isRead?: boolean;
	isArchived?: boolean;
}

/**
 * Published on the CQRS bus by `EmployeeNotificationService` after a notification's read or archive state changed
 * (an edit, or mark-all-read). The Inbox plugin mirrors it onto the recipient rows of the items it filed for these
 * notifications, so the bell and the inbox agree.
 */
export class EmployeeNotificationUpdatedEvent implements IEvent {
	constructor(public readonly change: IEmployeeNotificationStateChange) {}
}
