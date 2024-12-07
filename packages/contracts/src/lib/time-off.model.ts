import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IImageAsset as IDocumentAsset } from './image-asset.model';

export interface ITimeOffPolicy
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	employees?: IEmployee[];
}

export interface ITimeOffPolicyCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOff extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	description?: string;
	policy?: ITimeOffPolicy;
	policyId?: ITimeOffPolicy['id'];
	document?: IDocumentAsset | null;
	documentId?: IDocumentAsset['id'] | null;
	start: Date;
	end: Date;
	requestDate: Date;
	status?: string;
	isHoliday?: boolean;
	documentUrl?: string;
	fullName?: string;
	imageUrl?: string;
}

export interface ITimeOffFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	isArchived?: boolean;
	startDate?: Date;
	endDate?: Date;
}

export interface ITimeOffUpdateInput {
	status?: string;
}

export interface ITimeOffCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	description?: string;
	policy?: ITimeOffPolicy;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
	isHoliday?: boolean;
	documentUrl?: string;
}

export enum StatusTypesEnum {
	REQUESTED = 'REQUESTED',
	APPROVED = 'APPROVED',
	DENIED = 'DENIED',
	ALL = 'ALL'
}

export enum StatusTypesMapRequestApprovalEnum {
	REQUESTED = 1,
	APPROVED = 2,
	DENIED = 3
}
