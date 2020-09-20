import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface ITimeOffPolicy
	extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyCreateInput {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyUpdateInput {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyFindInput {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOff extends IBasePerTenantAndOrganizationEntityModel {
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

export interface ITimeOffFindInput {
	employeeId?: string;
	organizationId?: string;
}

export interface ITimeOffUpdateInput {
	status?: string;
}

export interface ITimeOffCreateInput {
	employees?: IEmployee[];
	organizationId?: string;
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
	REQUESTED = 'Requested',
	APPROVED = 'Approved',
	DENIED = 'Denied',
	ALL = 'All'
}

export enum StatusTypesMapRequestApprovalEnum {
	Requested = 1,
	Approved = 2,
	Denied = 3
}
