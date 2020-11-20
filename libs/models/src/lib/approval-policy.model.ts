import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IApprovalPolicy
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	approvalType?: string;
}

export interface IApprovalPolicyCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	approvalType?: string;
}

export interface IApprovalPolicyUpdateInput extends IApprovalPolicyCreateInput {
	id?: string;
}

export interface IApprovalPolicyFindInput {
	name?: string;
	description?: string;
	nameConstapprovalType?: string;
}

export enum ApprovalPolicyTypesEnum {
	TIME_OFF = 1,
	EQUIPMENT_SHARING = 2,
	BUSINESS_TRIP = 3
}

export enum ApprovalPolicyTypesStringEnum {
	TIME_OFF = 'TIME_OFF',
	EQUIPMENT_SHARING = 'EQUIPMENT_SHARING',
	BUSINESS_TRIP = 'EQUIPMENT_SHARING'
}
