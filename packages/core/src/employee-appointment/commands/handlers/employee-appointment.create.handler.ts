import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { LanguagesEnum } from '@gauzy/contracts';
import { EmailService } from './../../../email-send/email.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(EmployeeAppointmentCreateCommand)
export class EmployeeAppointmentCreateHandler
	implements ICommandHandler<EmployeeAppointmentCreateCommand> {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly emailService: EmailService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) { }

	public async execute(
		command?: EmployeeAppointmentCreateCommand
	): Promise<EmployeeAppointment> {
		const { employeeAppointmentInput, languageCode } = command;

		const appointment = new EmployeeAppointment();
		const employee = employeeAppointmentInput.employeeId
			? await this.employeeService.findOneByIdString(
				employeeAppointmentInput.employeeId
			)
			: null;
		const organization = await this.organizationService.findOneByIdString(
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
		appointment.tenantId = RequestContext.currentTenantId();

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
