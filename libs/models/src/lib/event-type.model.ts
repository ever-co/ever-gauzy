import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';

export interface IEventType extends IBaseEntityModel {
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	isActive: boolean;
	employeeId?: string;
	organizationId: string;
	employee?: Employee;
	organization: Organization;
}

export interface IEventTypeFindInput extends IBaseEntityModel {
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}

export interface IEventTypeCreateInput {
	employeeId?: string;
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	isActive: boolean;
	organizationId: string;
}

export interface IEventTypeUpdateInput {
	employeeId?: string;
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	organizationId?: string;
}
