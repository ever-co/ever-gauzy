import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { AppointmentEmployees } from './appointment-employees.model';

export interface EmployeeAppointment extends IBaseEntityModel {
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
}

export interface IEmployeeAppointmentCreateInput {
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
}
