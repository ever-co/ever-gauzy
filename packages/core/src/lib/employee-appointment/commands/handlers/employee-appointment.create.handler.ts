import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { ID, LanguagesEnum } from '@gauzy/contracts';
import { EmailService } from './../../../email-send/email.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { RequestContext } from '../../../core/context';
import { MeetingNotificationService } from '../../meeting-notifications/meeting-notification.service';

@CommandHandler(EmployeeAppointmentCreateCommand)
export class EmployeeAppointmentCreateHandler
	implements ICommandHandler<EmployeeAppointmentCreateCommand> {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly emailService: EmailService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly meetingNotifications: MeetingNotificationService
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
		const tenantId = RequestContext.currentTenantId();

		// The employees invited to the meeting (ever-co/ever-teams#5022): checked before anything is written, so a
		// request naming someone outside the organization creates nothing
		const inviteeIds: ID[] =
			employeeAppointmentInput.inviteeEmployeeIds !== undefined
				? await this.meetingNotifications.checkedInviteeIdsOf(
					employeeAppointmentInput.inviteeEmployeeIds,
					{ organizationId: organization?.id, tenantId },
					employee?.id
				)
				: [];

		appointment.employee = employee;
		appointment.organization = organization;
		appointment.agenda = employeeAppointmentInput.agenda;
		appointment.description = employeeAppointmentInput.description;
		appointment.bufferTimeEnd = employeeAppointmentInput.bufferTimeEnd;
		// Both fields are optional: `+undefined` is NaN, which the integer column rejects, so keep null when absent
		appointment.bufferTimeInMins =
			employeeAppointmentInput.bufferTimeInMins != null ? +employeeAppointmentInput.bufferTimeInMins : null;
		appointment.breakStartTime = employeeAppointmentInput.breakStartTime;
		appointment.breakTimeInMins =
			employeeAppointmentInput.breakTimeInMins != null ? +employeeAppointmentInput.breakTimeInMins : null;
		appointment.bufferTimeStart = employeeAppointmentInput.bufferTimeStart;
		appointment.emails = employeeAppointmentInput.emails;
		appointment.startDateTime = employeeAppointmentInput.startDateTime;
		appointment.endDateTime = employeeAppointmentInput.endDateTime;
		appointment.location = employeeAppointmentInput.location;
		appointment.tenantId = tenantId;

		const createdAppointment = await this.employeeAppointmentService.create(
			appointment
		);

		if (appointment.emails) {
			this._sendAppointmentEmail(appointment, languageCode);
		}

		if (inviteeIds.length) {
			const meeting = {
				id: createdAppointment.id,
				tenantId: createdAppointment.tenantId ?? tenantId,
				organizationId: createdAppointment.organizationId ?? organization?.id,
				employeeId: createdAppointment.employeeId ?? employee?.id ?? null,
				agenda: createdAppointment.agenda,
				startDateTime: createdAppointment.startDateTime,
				endDateTime: createdAppointment.endDateTime
			};
			await this.meetingNotifications.replaceInvitees(meeting, inviteeIds);
			await this.meetingNotifications.notify('invited', meeting, inviteeIds, {
				sentByEmployeeId: RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? null
			});
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
