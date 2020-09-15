import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployeeAppointment } from './employee-appointment.model';

export interface IAppointmentEmployee
	extends IBasePerTenantAndOrganizationEntityModel {
	appointmentId: string;
	employeeId: string;
	employeeAppointment: IEmployeeAppointment;
}
