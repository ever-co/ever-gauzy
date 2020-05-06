import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface AppointmentEmployees extends IBaseEntityModel {
	appointmentId: string;
	employeeId: string;
}
