import { BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IMention extends IBasePerTenantAndOrganizationEntityModel {
	entityId: ID;
	entity: BaseEntityEnum;
	mentionedUserId: ID;
	mentionedUser?: IUser;
	mentionById: ID;
	mentionBy?: IUser;
}

export interface IMentionCreateInput extends Omit<IMention, 'mentionBy'> {}
