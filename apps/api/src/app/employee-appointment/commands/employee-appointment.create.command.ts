import { ICommand } from '@nestjs/cqrs';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class EmployeeAppointmentCreateCommand implements ICommand {
	static readonly type = '[EmployeeAppointment] Register';

	constructor(
		public readonly employeeAppointmentInput: EmployeeAppointment
	) {}
}
