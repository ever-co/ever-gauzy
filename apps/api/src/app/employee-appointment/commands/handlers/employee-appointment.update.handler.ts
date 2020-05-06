import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';

@CommandHandler(EmployeeAppointmentUpdateCommand)
export class EmployeeAppointmentUpdateHandler
	implements ICommandHandler<EmployeeAppointmentUpdateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService
	) {}

	public async execute(
		command?: EmployeeAppointmentUpdateCommand
	): Promise<EmployeeAppointment> {
		const { employeeAppointmentUpdateRequest } = command;

		return await this.employeeAppointmentService.saveAppointment(
			employeeAppointmentUpdateRequest
		);
	}
}
