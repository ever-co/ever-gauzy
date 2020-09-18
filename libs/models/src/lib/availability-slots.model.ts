import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';

export interface IAvailabilitySlot
	extends IBasePerTenantAndOrganizationEntityModel {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: string;
	employeeId?: string;
	employee?: IEmployee;
}

export interface IAvailabilitySlotsFindInput {
	type?: string;
	employee?: IEmployeeFindInput;
	organization?: IOrganizationFindInput;
}

export interface IAvailabilitySlotsCreateInput {
	type: string;
	allDay: boolean;
	startTime: Date;
	endTime: Date;
	employeeId?: string;
	organizationId: string;
}
