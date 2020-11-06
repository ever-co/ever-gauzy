import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';

export interface IAvailabilitySlot
	extends IBasePerTenantAndOrganizationEntityModel {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: string;
	employeeId?: string;
	employee?: IEmployee;
}

export interface IAvailabilitySlotsFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	type?: string;
	employee?: IEmployeeFindInput;
}

export interface IAvailabilitySlotsCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	type: string;
	allDay: boolean;
	startTime: Date;
	endTime: Date;
	employeeId?: string;
}

export interface IAvailabilitySlotsView
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type?: string;
	employeeId?: string;
	employee?: IEmployee;
}
