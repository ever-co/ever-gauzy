import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';

export interface IAvailabilitySlots extends IBaseEntityModel {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: string;
	employeeId?: string;
	organizationId: string;
	employee?: Employee;
	organization: Organization;
}

export interface IAvailabilitySlotsFindInput extends IBaseEntityModel {
	type?: string;
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}

export interface IAvailabilitySlotsCreateInput {
	type: string;
	allDay: boolean;
	startTime: Date;
	endTime: Date;
	employeeId?: string;
	organizationId: string;
}
