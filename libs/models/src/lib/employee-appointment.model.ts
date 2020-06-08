import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { AppointmentEmployees } from './appointment-employees.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization } from './organization.model';

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
	organization: Organization;
}

export interface IEmployeeAppointmentFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	employeeId?: string;
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
	invitees?: AppointmentEmployees[];
}
