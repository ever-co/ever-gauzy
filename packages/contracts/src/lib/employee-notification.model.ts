import { IBasePerEntityType, ID, OmitFields } from './base-entity.model';
import { IEmployee } from './employee.model';

/**
 * Represents an employee notification with details such as title, message, type,
 * sender/receiver information, and status flags like read and on-hold.
 */
export interface IEmployeeNotification extends IBasePerEntityType {
	title?: string;
	message?: string;
	type?: EmployeeNotificationTypeEnum;
	isRead?: boolean;
	readAt?: Date;
	onHoldUntil?: Date;
	sentByEmployeeId?: ID;
	sentByEmployee?: IEmployee;
	receiverEmployeeId?: ID;
	receiverEmployee?: IEmployee;
	/**
	 * The comment the notification is about, when it is about one (a comment on a record the receiver follows): the
	 * record itself stays in `entity` / `entityId`, so a client that knows no comments still opens the record.
	 */
	commentId?: ID;
}

/**
 * Enum for employee notification types.
 * Values indicate the type of notification and their respective DB representations.
 */
export enum EmployeeNotificationTypeEnum {
	PAYMENT = 'Payment', // Stored as 0 in DB
	ASSIGNMENT = 'Assignment', // Stored as 1 in DB
	INVITATION = 'Invitation', // Stored as 2 in DB
	MENTION = 'Mention', // Stored as 3 in DB
	COMMENT = 'Comment', // Stored as 4 in DB
	MESSAGE = 'Message', // Stored as 5 in DB
	BROADCAST = 'Broadcast', // Stored as 6 in DB
	RATE_CHANGE_REQUEST = 'RateChangeRequest', // Stored as 7 in DB
	/** A record the employee follows changed (a task's status, for example). Stored as 8 in DB. */
	TASK_UPDATE = 'TaskUpdate',
	/**
	 * The employee's timer has been running past their reminder threshold (`timerReminderHours` of the notification
	 * preferences), or past twice it. Raised by the platform's timer reminder sweep, once per run and level. Stored as
	 * 9 in DB.
	 */
	TIMER_REMINDER = 'TimerReminder'
}

/**
 * Enum for notification actions.
 * Represents the actions that trigger notifications within the system.
 */
export enum NotificationActionTypeEnum {
	Paid = 'Paid',
	Assigned = 'Assigned',
	Invited = 'Invited',
	Mentioned = 'Mentioned',
	Commented = 'Commented',
	Messaged = 'Messaged',
	Broadcasted = 'Broadcasted',
	/** A followed record was changed (status, assignment, dates). */
	Updated = 'Updated'
}

/**
 * Input type for creating an employee notification.
 * Omits the system-managed fields (`isRead` and `readAt`) that are automatically set.
 */
export interface IEmployeeNotificationCreateInput extends OmitFields<IEmployeeNotification, 'isRead' | 'readAt'> {}

/**
 * Input type for updating an employee notification.
 * Excludes immutable fields (`receiverId`, `receiver`, `sentById`, and `sentBy`)
 * to prevent altering relationships after creation.
 */
export interface IEmployeeNotificationUpdateInput
	extends OmitFields<
		IEmployeeNotification,
		'receiverEmployee' | 'receiverEmployeeId' | 'sentByEmployee' | 'sentByEmployeeId'
	> {}

/**
 * Interface representing the result of marking notifications as read.
 */
export interface IMarkAllAsReadResponse {
	success: boolean;
	count: number;
}
