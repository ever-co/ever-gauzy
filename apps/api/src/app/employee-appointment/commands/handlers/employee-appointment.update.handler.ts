import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { UpdateResult } from 'typeorm';

@CommandHandler(EmployeeAppointmentUpdateCommand)
export class EmployeeAppointmentUpdateHandler
	implements ICommandHandler<EmployeeAppointmentUpdateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService
	) {}

	public async execute(
		command?: EmployeeAppointmentUpdateCommand
	): Promise<UpdateResult | EmployeeAppointment> {
		const { id, employeeAppointmentUpdateRequest } = command;

		return await this.employeeAppointmentService.update(
			id,
			employeeAppointmentUpdateRequest
		);
	}
}
