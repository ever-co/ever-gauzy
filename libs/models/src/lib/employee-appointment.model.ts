import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IAppointmentEmployee } from './appointment-employees.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';

export interface IEmployeeAppointment
	extends IBasePerTenantAndOrganizationEntityModel {
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
	status?: string;
}

export interface IEmployeeAppointmentFindInput {
	employee?: IEmployeeFindInput;
	employeeId?: string;
	status?: string;
	organization?: IOrganizationFindInput;
}

export interface IEmployeeAppointmentCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
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

export interface IEmployeeAppointmentUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
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
	status?: string;
	invitees?: IAppointmentEmployee[];
}
