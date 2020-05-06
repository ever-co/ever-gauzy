import { ICommand } from '@nestjs/cqrs';
import { EmployeeAppointment } from '../employee-appointment.entity';

export class EmployeeAppointmentUpdateCommand implements ICommand {
	static readonly type = '[EmployeeAppointment] Update';

	constructor(
		public readonly id: string,
		public readonly employeeAppointmentUpdateRequest: EmployeeAppointment
	) {}
}
