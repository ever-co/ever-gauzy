import { BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export interface IMention extends IBasePerTenantAndOrganizationEntityModel {
	entityId: ID;
	entity: BaseEntityEnum;
	mentionnedUserId: ID;
	mentionBy: ID;
}

export interface IMentionCreateInput extends Omit<IMention, 'mentionBy'> {}
