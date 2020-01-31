import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';

export interface TimeOffPolicy extends IBaseEntityModel {
	employees?: Employee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface TimeOffPolicyCreateInput extends IBaseEntityModel {
	employees?: Employee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface TimeOffPolicyFindInput extends IBaseEntityModel {
	employees?: Employee[];
	// teams?: OrganizationTeams[];
	organizationId?: string;
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface TimeOff extends IBaseEntityModel {
	employee?: Employee;
	organizationId?: string;
	description?: string;
	policy?: string;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
}

export interface TimeOffFindInput extends IBaseEntityModel {
	employee?: Employee;
	organizationId?: string;
	description?: string;
	policy?: string;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
}

export interface TimeOffUpdateInput {
	employee?: Employee;
	organizationId?: string;
	description?: string;
	policy?: string;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
}

export interface TimeOffCreateInput {
	employee?: Employee;
	organizationId?: string;
	description?: string;
	policy?: string;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
}

export enum StatusTypesEnum {
	REQUESTED = 'Requested',
	APPROVED = 'Approved',
	DENIED = 'Denied',
	ALL = 'All'
}
