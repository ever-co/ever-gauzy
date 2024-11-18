import { ICommand } from '@nestjs/cqrs';
import { IEmployeeAppointmentUpdateInput } from '@gauzy/contracts';

export class EmployeeAppointmentUpdateCommand implements ICommand {
	static readonly type = '[EmployeeAppointment] Update';

	constructor(
		public readonly id: string,
		public readonly employeeAppointmentUpdateRequest: IEmployeeAppointmentUpdateInput
	) {}
}
