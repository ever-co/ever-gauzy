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
		const organization = employeeAppointmentUpdateRequest.organizationId
			? await this.organizationService.findOne(
					employeeAppointmentUpdateRequest.organizationId
			  )
			: null;

		employee && (appointment.employee = employee);
		organization && (appointment.organization = organization);
		employeeAppointmentUpdateRequest.agenda &&
			(appointment.agenda = employeeAppointmentUpdateRequest.agenda);
		employeeAppointmentUpdateRequest.description &&
			(appointment.description =
				employeeAppointmentUpdateRequest.description);
		employeeAppointmentUpdateRequest.bufferTimeEnd &&
			(appointment.bufferTimeEnd =
				employeeAppointmentUpdateRequest.bufferTimeEnd);
		employeeAppointmentUpdateRequest.bufferTimeInMins &&
			(appointment.bufferTimeInMins =
				employeeAppointmentUpdateRequest.bufferTimeInMins);
		employeeAppointmentUpdateRequest.breakStartTime &&
			(appointment.breakStartTime =
				employeeAppointmentUpdateRequest.breakStartTime);
		employeeAppointmentUpdateRequest.breakTimeInMins &&
			(appointment.breakTimeInMins =
				employeeAppointmentUpdateRequest.breakTimeInMins);
		employeeAppointmentUpdateRequest.bufferTimeStart &&
			(appointment.bufferTimeStart =
				employeeAppointmentUpdateRequest.bufferTimeStart);
		employeeAppointmentUpdateRequest.startDateTime &&
			(appointment.startDateTime =
				employeeAppointmentUpdateRequest.startDateTime);
		employeeAppointmentUpdateRequest.endDateTime &&
			(appointment.endDateTime =
				employeeAppointmentUpdateRequest.endDateTime);
		employeeAppointmentUpdateRequest.location &&
			(appointment.location = employeeAppointmentUpdateRequest.location);
		employeeAppointmentUpdateRequest.status &&
			(appointment.status = employeeAppointmentUpdateRequest.status);

		const updatedAppointment = await this.employeeAppointmentService.update(
			id,
			appointment
		);

		return updatedAppointment;
	}
}
