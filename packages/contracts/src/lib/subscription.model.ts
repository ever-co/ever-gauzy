import { IBasePerEntityType, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IEntitySubscription extends IBasePerEntityType {
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

export interface IEntitySubscriptionCreateInput
	extends Omit<IEntitySubscription, 'user' | 'userId'>,
		Partial<Pick<IEntitySubscription, 'userId'>> {}

export interface IEntitySubscriptionFindInput extends Partial<IEntitySubscription> {}
