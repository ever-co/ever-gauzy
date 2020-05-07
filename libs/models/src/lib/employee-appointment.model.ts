import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';

export interface EmployeeAppointment extends IBaseEntityModel {
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	invitees: Employee[];
}

export interface IEmployeeAppointmentCreateInput {
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	invitees: Employee[];
}
