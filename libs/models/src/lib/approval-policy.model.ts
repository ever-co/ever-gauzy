import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ApprovalPolicy extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	type?: number;
	description?: string;
}

export interface ApprovalPolicyCreateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	type?: number;
	description?: string;
}

export interface ApprovalPolicyUpdateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	type?: number;
	description?: string;
}

export interface ApprovalPolicyFindInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	type?: number;
	description?: string;
}

export enum ApprovalPolicyTypesEnum {
	TIME_OFF = 1,
	EQUIPMENT_SHARING = 2,
	BUSINESS_TRIP = 3
}
