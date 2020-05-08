import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { AppointmentEmployees } from './appointment-employees.model';

export interface EmployeeAppointment extends IBaseEntityModel {
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	invitees?: AppointmentEmployees[];
}

export interface IEmployeeAppointmentCreateInput {
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	invitees?: AppointmentEmployees[];
}
