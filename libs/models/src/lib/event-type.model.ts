import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';
import { ITag } from '..';

export interface IEventType extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	isActive: boolean;
	employeeId?: string;
	employee?: IEmployee;
	tags?: ITag[];
}

export interface IEventTypeFindInput {
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	employee?: IEmployeeFindInput;
	organization?: IOrganizationFindInput;
	tags?: ITag[];
}

export interface IEventTypeCreateInput {
	employeeId?: string;
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	isActive: boolean;
	organizationId: string;
	tags?: ITag[];
}

export interface IEventTypeUpdateInput {
	employeeId?: string;
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	organizationId?: string;
	tags?: ITag[];
}
