import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { LanguagesEnum } from '@gauzy/models';
import { EmailService } from '../../../email';

@CommandHandler(EmployeeAppointmentCreateCommand)
export class EmployeeAppointmentCreateHandler
	implements ICommandHandler<EmployeeAppointmentCreateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService,
		private emailService: EmailService
	) {}

	public async execute(
		command?: EmployeeAppointmentCreateCommand
	): Promise<EmployeeAppointment> {
		const { employeeAppointmentInput, languageCode } = command;

		const appointment = await this.employeeAppointmentService.create(
			employeeAppointmentInput
		);

		if (appointment.emails) {
			this._sendAppointmentEmail(appointment, languageCode);
		}

		return appointment;
	}

	private _sendAppointmentEmail(
		appointment: EmployeeAppointment,
		languageCode: LanguagesEnum
	) {
		appointment.emails
			.split(', ')
			.map((email) =>
				this.emailService.sendAppointmentMail(email, languageCode)
			);
	}
}
