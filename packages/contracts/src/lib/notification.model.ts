import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface INotification extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType {
	title?: string;
	message?: string;
	type?: NotificationTypeEnum;
	sentById?: ID;
	sentBy?: IUser;
	isRead?: boolean;
	readedAt?: Date;
	receiverId?: ID;
	receiver?: IUser;
}

export enum NotificationTypeEnum {
	PAYMENT = 'Payment', // Will be stored as 0 in DB
	ASSIGNEMENT = 'Assignement', // Will be stored as 1 in DB
	INVITATION = 'Invitation', // Will be stored as 2 in DB
	MENTION = 'Mention', // Will be stored as 3 in DB
	COMMENT = 'Comment', // Will be stored as 4 in DB
	MESSAGE = 'Message' // Will be stored as 5 in DB
}

export interface INotificationCreateInput extends Omit<INotification, 'isRead' | 'readedAt'> {}

export interface INotificationUpdateInput
	extends Omit<INotification, 'receiverId' | 'receiver' | 'sentById' | 'sentBy'> {}
