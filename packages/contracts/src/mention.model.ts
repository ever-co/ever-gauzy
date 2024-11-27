import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IMention extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType {
	mentionedUserId: ID;
	mentionedUser?: IUser;
	mentionById: ID;
	mentionBy?: IUser;
}

export interface IMentionCreateInput extends Omit<IMention, 'mentionBy'> {}
