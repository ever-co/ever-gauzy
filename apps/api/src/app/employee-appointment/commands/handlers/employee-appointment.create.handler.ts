import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';

@CommandHandler(EmployeeAppointmentCreateCommand)
export class EmployeeAppointmentCreateHandler
	implements ICommandHandler<EmployeeAppointmentCreateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService
	) {}

	public async execute(
		command?: EmployeeAppointmentCreateCommand
	): Promise<EmployeeAppointment> {
		const { employeeAppointmentInput } = command;

		return await this.employeeAppointmentService.create(
			employeeAppointmentInput
		);
	}
}
