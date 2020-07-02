import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { UpdateResult } from 'typeorm';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';

@CommandHandler(EmployeeAppointmentUpdateCommand)
export class EmployeeAppointmentUpdateHandler
	implements ICommandHandler<EmployeeAppointmentUpdateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService,
		private employeeService: EmployeeService,
		private organizationService: OrganizationService
	) {}

	public async execute(
		command?: EmployeeAppointmentUpdateCommand
	): Promise<UpdateResult | EmployeeAppointment> {
		const { id, employeeAppointmentUpdateRequest } = command;

		const appointment = new EmployeeAppointment();
		const employee = employeeAppointmentUpdateRequest.employeeId
			? await this.employeeService.findOne(
					employeeAppointmentUpdateRequest.employeeId
			  )
			: null;
		const organization = await this.organizationService.findOne(
			employeeAppointmentUpdateRequest.organizationId
		);

		appointment.employee = employee;
		appointment.organization = organization;
		appointment.agenda = employeeAppointmentUpdateRequest.agenda;
		appointment.description = employeeAppointmentUpdateRequest.description;
		appointment.bufferTimeEnd =
			employeeAppointmentUpdateRequest.bufferTimeEnd;
		appointment.bufferTimeInMins =
			employeeAppointmentUpdateRequest.bufferTimeInMins;
		appointment.breakStartTime =
			employeeAppointmentUpdateRequest.breakStartTime;
		appointment.breakTimeInMins =
			employeeAppointmentUpdateRequest.breakTimeInMins;
		appointment.bufferTimeStart =
			employeeAppointmentUpdateRequest.bufferTimeStart;
		appointment.startDateTime =
			employeeAppointmentUpdateRequest.startDateTime;
		appointment.endDateTime = employeeAppointmentUpdateRequest.endDateTime;
		appointment.location = employeeAppointmentUpdateRequest.location;

		const updatedAppointment = await this.employeeAppointmentService.update(
			id,
			appointment
		);

		return updatedAppointment;
	}
}
