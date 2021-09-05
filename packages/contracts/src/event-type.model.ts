import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { ITag } from './tag-entity.model';

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

export interface IEventTypeFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	employee?: IEmployeeFindInput;
	tags?: ITag[];
}

export interface IEventTypeCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	isActive: boolean;
	tags?: ITag[];
}

export interface IEventTypeUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	title?: string;
	description?: string;
	duration?: number;
	durationUnit?: string;
	isActive?: boolean;
	tags?: ITag[];
}

export interface IEventTypeViewModel {
	title: string;
	description: string;
	durationFormat: string;
	id: string;
	active: string;
	isActive: boolean;
	duration: Number;
	durationUnit: string;
	tags: ITag[];
	isDefault?: boolean;
	employeeId?: string;
    employee?: IEmployee;
}
