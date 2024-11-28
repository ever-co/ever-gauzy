import { BaseEntityEnum, IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IMention extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType {
	mentionedUserId: ID;
	mentionedUser?: IUser;
	mentionById: ID;
	mentionBy?: IUser;
	parentEntityId?: ID; // E.g : If the mention is in a comment, we need this for subscription and notifications purpose (It could be the task ID concerned by comment, then the user will be subscribed to that task instead of to a comment itself)
	parentEntityType?: BaseEntityEnum;
}

export interface IMentionCreateInput extends Omit<IMention, 'mentionBy'> {}
