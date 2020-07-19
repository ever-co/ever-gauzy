import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EmployeeAppointment } from './employee-appointment.model';

export interface AppointmentEmployees extends IBaseEntityModel {
	appointmentId: string;
	employeeId: string;
	employeeAppointment: EmployeeAppointment;
}
