import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ApprovalPolicy extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	description?: string;
	nameConst?: string;
}

export interface ApprovalPolicyCreateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	description?: string;
	nameConst?: string;
}

export interface ApprovalPolicyUpdateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	description?: string;
	nameConst?: string;
}

export interface ApprovalPolicyFindInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	description?: string;
	nameConst?: string;
}

export enum ApprovalPolicyTypesEnum {
	TIME_OFF = 1,
	EQUIPMENT_SHARING = 2,
	BUSINESS_TRIP = 3
}

export const ApprovalPolicyConst = {
	TIME_OFF: 'TIME_OFF',
	EQUIPMENT_SHARING: 'EQUIPMENT_SHARING'
};
