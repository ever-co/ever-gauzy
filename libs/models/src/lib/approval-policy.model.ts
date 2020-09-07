import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { ITenant } from './tenant.model';
import { Organization } from './organization.model';

export interface ApprovalPolicy extends IBaseEntityModel {
	organizationId?: string;
	organization?: Organization;
	tenant?: ITenant;
	tenantId?: string;
	name?: string;
	description?: string;
	approvalType?: string;
}

export interface ApprovalPolicyCreateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId: string;
	tenant?: ITenant;
	name?: string;
	description?: string;
	approvalType?: string;
}

export interface ApprovalPolicyUpdateInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId: string;
  tenant: ITenant;
	name?: string;
	description?: string;
	approvalType?: string;
}

export interface ApprovalPolicyFindInput extends IBaseEntityModel {
	organizationId?: string;
	tenantId: string;
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
