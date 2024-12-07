import { EmployeeAppointmentCreateHandler } from './employee-appointment.create.handler';
import { EmployeeAppointmentUpdateHandler } from './employee-appointment.update.handler';

export const CommandHandlers = [
	EmployeeAppointmentCreateHandler,
	EmployeeAppointmentUpdateHandler
];
