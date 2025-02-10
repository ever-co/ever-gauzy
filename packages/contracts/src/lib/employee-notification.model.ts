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
	sentById?: ID;
	sentBy?: IEmployee;
	isRead?: boolean;
	readAt?: Date;
	onHoldUntil?: Date;
	receiverId?: ID;
	receiver?: IEmployee;
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
	MESSAGE = 'Message' // Stored as 5 in DB
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
	Messaged = 'Messaged'
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
	extends OmitFields<IEmployeeNotification, 'receiverId' | 'receiver' | 'sentById' | 'sentBy'> {}
