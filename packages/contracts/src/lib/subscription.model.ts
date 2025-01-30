import { IBasePerEntityType, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface ISubscription extends IBasePerEntityType {
	type: SubscriptionTypeEnum;
	userId: ID;
	user?: IUser;
}

export enum SubscriptionTypeEnum {
	MANUAL = 'manual',
	MENTION = 'mention',
	ASSIGNMENT = 'assignment',
	COMMENT = 'comment',
	CREATED_ENTITY = 'created-entity'
}

export interface ISubscriptionCreateInput
	extends Omit<ISubscription, 'user' | 'userId'>,
	Partial<Pick<ISubscription, 'userId'>> { }

export interface ISubscriptionFindInput extends Partial<ISubscription> { }
