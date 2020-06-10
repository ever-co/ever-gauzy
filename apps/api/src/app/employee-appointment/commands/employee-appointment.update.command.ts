import { ICommand } from '@nestjs/cqrs';
import { IEmployeeAppointmentCreateInput } from '@gauzy/models';

export class EmployeeAppointmentUpdateCommand implements ICommand {
	static readonly type = '[EmployeeAppointment] Update';

	constructor(
		public readonly id: string,
		public readonly employeeAppointmentUpdateRequest: IEmployeeAppointmentCreateInput
	) {}
}
