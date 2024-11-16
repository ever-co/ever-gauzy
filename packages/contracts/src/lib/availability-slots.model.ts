import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';

export interface IAvailabilitySlot
	extends IBasePerTenantAndOrganizationEntityModel {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: AvailabilitySlotType;
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
	type: AvailabilitySlotType;
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
	type?: AvailabilitySlotType;
	employeeId?: string;
	employee?: IEmployee;
}

export enum AvailabilitySlotType {
	DEFAULT = 'Default',
	RECURRING = 'Recurring'
}

export interface IGetAvailabilitySlotsConflictInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	relations?: string[];
	ignoreId?: string | string[];
	startTime: Date;
	endTime: Date;
	employeeId?: string;
	type?: AvailabilitySlotType;
}

export enum AvailabilityMergeType {
	MERGE = 'merge',
	REMOVE = 'remove',
	SKIP = 'skip'
}
