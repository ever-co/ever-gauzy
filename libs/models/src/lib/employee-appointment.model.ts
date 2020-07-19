import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { AppointmentEmployees } from './appointment-employees.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';

export interface EmployeeAppointment extends IBaseEntityModel {
	employee?: Employee;
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
	invitees?: AppointmentEmployees[];
	organizationId: string;
	emails?: string;
	status?: string;
	organization: Organization;
}

export interface IEmployeeAppointmentFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	employeeId?: string;
	status?: string;
	organization?: OrganizationFindInput;
}

export interface IEmployeeAppointmentCreateInput {
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
	organizationId?: string;
	emails?: string;
	invitees?: AppointmentEmployees[];
}

export interface IEmployeeAppointmentUpdateInput {
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
	organizationId?: string;
	status?: string;
	invitees?: AppointmentEmployees[];
}
