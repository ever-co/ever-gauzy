import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EmployeeAppointment } from './employee-appointment.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface AppointmentEmployees extends IBaseEntityModel {
	appointmentId: string;
	employeeId: string;
	employeeAppointment: EmployeeAppointment;
  organization: Organization;
  tenant: ITenant;
}
