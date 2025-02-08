import { IBasePerEntityType, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IUserNotification extends IBasePerEntityType {
	title?: string;
	message?: string;
	type?: UserNotificationTypeEnum;
	sentById?: ID;
	sentBy?: IUser;
	isRead?: boolean;
	readAt?: Date;
	onHoldUntil?: Date;
	receiverId?: ID;
	receiver?: IUser;
}

/**
 * Enum for notification types.
 */
export enum UserNotificationTypeEnum {
	PAYMENT = 'Payment', // Will be stored as 0 in DB
	ASSIGNMENT = 'Assignment', // Will be stored as 1 in DB
	INVITATION = 'Invitation', // Will be stored as 2 in DB
	MENTION = 'Mention', // Will be stored as 3 in DB
	COMMENT = 'Comment', // Will be stored as 4 in DB
	MESSAGE = 'Message' // Will be stored as 5 in DB
}

/**
 * Enum for notification action types.
 */
export enum NotificationActionTypeEnum {
	Paid = 'Paid',
	Assigned = 'Assigned',
	Invited = 'Invited',
	Mentioned = 'Mentioned',
	Commented = 'Commented',
	Messaged = 'Messaged'
}

export interface IUserNotificationCreateInput extends Omit<IUserNotification, 'isRead' | 'readAt'> {}

export interface INotificationUpdateInput
	extends Omit<IUserNotification, 'receiverId' | 'receiver' | 'sentById' | 'sentBy'> {}
