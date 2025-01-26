import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface INotification extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType {
	title?: string;
	message?: string;
	sentById?: ID;
	sentBy?: IUser;
	isRead?: boolean;
	readedAt?: Date;
	receiverId?: ID;
	receiver?: IUser;
}

export enum NotificationTypeEnum {
	PAYMENT = 0,
	ASSIGNEMENT = 1,
	INVITATION = 2,
	MENTION = 3,
	COMMENT = 4,
	MESSAGE = 5
}

export interface INotificationCreateInput extends Omit<INotification, 'isRead' | 'readedAt'> {}

export interface INotificationUpdateInput
	extends Omit<INotification, 'receiverId' | 'receiver' | 'sentById' | 'sentBy'> {}
