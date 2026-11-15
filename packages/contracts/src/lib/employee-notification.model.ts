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
	/**
	 * What the notification says about a thing outside the platform, which no column holds: the Board of a
	 * `BoardShare` or a `BoardMention`. Null for every other kind.
	 */
	metadata?: IEmployeeNotificationMetadata | null;
}

/**
 * A Board of the Boards app a notification is about (`BoardShare`, `BoardMention`). A Board is no record of the
 * platform, and its content is end-to-end encrypted in the Boards app, so the notification carries what its receiver
 * is shown and can open, each as the sender's app sent it: one of `roomId` and `snapshotId`, the name, and the link.
 */
export interface IEmployeeNotificationBoard {
	/** The Board's live room, when the Board is one. */
	roomId?: string;
	/** The Board's saved snapshot, when the Board is one. */
	snapshotId?: string;
	/** The Board's name, as the sender sees it, when their app sent one. */
	name?: string | null;
	/**
	 * The address that opens the Board, as sent. Its `#` part holds the Board's encryption key: the Boards app sends the
	 * link without it unless the sender chose to include it. The platform never logs it.
	 */
	link?: string | null;
}

/** What a notification says about a thing outside the platform (`IEmployeeNotification.metadata`). */
export interface IEmployeeNotificationMetadata {
	board?: IEmployeeNotificationBoard;
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
	TIMER_REMINDER = 'TimerReminder',
	/**
	 * An invoice or estimate of the organization needs the attention of whoever handles invoices: a client accepted or
	 * declined an estimate from the link it was sent with. Stored as 10 in DB.
	 */
	INVOICE = 'Invoice',
	/**
	 * A meeting (an employee appointment) the employee hosts or is invited to: they were invited to it or removed from
	 * it, it was changed or cancelled, or it starts soon. The notification's entity is the appointment; its title says
	 * which of these it is (see `meeting-notification.rules.ts`). Stored as 11 in DB.
	 */
	MEETING = 'Meeting',
	/**
	 * A task the employee is assigned to is due soon: its due date is less than their reminder threshold away
	 * (`taskDueReminderHours` of the notification preferences). Raised by the platform's task due reminder sweep, once
	 * per task, employee and due date. Stored as 12 in DB.
	 */
	TASK_DUE_REMINDER = 'TaskDueReminder',
	/**
	 * A colleague shared a Board with the employee, from the Boards app. A Board is no record of the platform: the
	 * notification names it in its `metadata` (`board`: the room or snapshot, its name and the link the sender chose to
	 * send, see `IEmployeeNotificationBoard`). Stored as 13 in DB.
	 */
	BOARD_SHARE = 'BoardShare',
	/**
	 * A colleague mentioned the employee in a Board, from the Boards app; the Board is named as for `BOARD_SHARE`. Not
	 * a `MENTION`, which is about a record of the platform: each has its own email and push modes. Stored as 14 in DB.
	 */
	BOARD_MENTION = 'BoardMention'
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
