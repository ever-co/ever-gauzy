import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IAppointmentEmployee } from './appointment-employees.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';

/**
 * Employee appointment status.
 */
export enum EmployeeAppointmentStatus {
	SCHEDULED = 'Scheduled',
	CANCELLED = 'Cancelled',
	COMPLETED = 'Completed'
}

export interface IEmployeeAppointment extends IBasePerTenantAndOrganizationEntityModel {
	employee?: IEmployee;
	employeeId?: string;
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	invitees?: IAppointmentEmployee[];
	emails?: string;
	status?: EmployeeAppointmentStatus;
}

export interface IEmployeeAppointmentFindInput {
	employee?: IEmployeeFindInput;
	employeeId?: string;
	status?: EmployeeAppointmentStatus;
	organization?: IOrganizationFindInput;
}

export interface IEmployeeAppointmentCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	emails?: string;
	invitees?: IAppointmentEmployee[];
}

export interface IEmployeeAppointmentUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	description?: string;
	location?: string;
	agenda?: string;
	startDateTime?: Date;
	endDateTime?: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	status?: EmployeeAppointmentStatus;
	invitees?: IAppointmentEmployee[];
}
