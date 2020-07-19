import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { LanguagesEnum } from '@gauzy/models';
import { EmailService } from '../../../email';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';

@CommandHandler(EmployeeAppointmentCreateCommand)
export class EmployeeAppointmentCreateHandler
	implements ICommandHandler<EmployeeAppointmentCreateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService,
		private emailService: EmailService,
		private employeeService: EmployeeService,
		private organizationService: OrganizationService
	) {}

	public async execute(
		command?: EmployeeAppointmentCreateCommand
	): Promise<EmployeeAppointment> {
		const { employeeAppointmentInput, languageCode } = command;

		const appointment = new EmployeeAppointment();
		const employee = employeeAppointmentInput.employeeId
			? await this.employeeService.findOne(
					employeeAppointmentInput.employeeId
			  )
			: null;
		const organization = await this.organizationService.findOne(
			employeeAppointmentInput.organizationId
		);

		appointment.employee = employee;
		appointment.organization = organization;
		appointment.agenda = employeeAppointmentInput.agenda;
		appointment.description = employeeAppointmentInput.description;
		appointment.bufferTimeEnd = employeeAppointmentInput.bufferTimeEnd;
		appointment.bufferTimeInMins =
			employeeAppointmentInput.bufferTimeInMins;
		appointment.breakStartTime = employeeAppointmentInput.breakStartTime;
		appointment.breakTimeInMins = employeeAppointmentInput.breakTimeInMins;
		appointment.bufferTimeStart = employeeAppointmentInput.bufferTimeStart;
		appointment.emails = employeeAppointmentInput.emails;
		appointment.startDateTime = employeeAppointmentInput.startDateTime;
		appointment.endDateTime = employeeAppointmentInput.endDateTime;
		appointment.location = employeeAppointmentInput.location;

		const createdAppointment = await this.employeeAppointmentService.create(
			appointment
		);

		if (appointment.emails) {
			this._sendAppointmentEmail(appointment, languageCode);
		}

		return createdAppointment;
	}

	private _sendAppointmentEmail(
		appointment: EmployeeAppointment,
		languageCode: LanguagesEnum
	) {
		appointment.emails
			.split(', ')
			.forEach((email) =>
				this.emailService.sendAppointmentMail(email, languageCode)
			);
	}
}
