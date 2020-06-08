import { ICommand } from '@nestjs/cqrs';
import { EmployeeAppointment } from '../employee-appointment.entity';
import { LanguagesEnum } from '@gauzy/models';

export class EmployeeAppointmentCreateCommand implements ICommand {
	static readonly type = '[EmployeeAppointment] Register';

	constructor(
		public readonly employeeAppointmentInput: EmployeeAppointment,
		public readonly languageCode: LanguagesEnum
	) {}
}
