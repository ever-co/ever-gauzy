import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployeeAppointment } from './employee-appointment.model';
import { IEmployee } from './employee.model';

export interface IAppointmentEmployee
	extends IBasePerTenantAndOrganizationEntityModel {
	appointmentId: string;
	employee?: IEmployee;
	employeeId?: string;
	employeeAppointment?: IEmployeeAppointment;
	employeeAppointmentId?: string;
}