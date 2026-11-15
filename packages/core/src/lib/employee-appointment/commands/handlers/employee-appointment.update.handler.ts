import { NotFoundException } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { UpdateResult } from 'typeorm';
import { EmployeeAppointmentStatus, ID } from '@gauzy/contracts';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../../../core/context';
import {
	IMeetingSnapshot,
	MeetingNotificationService
} from '../../meeting-notifications/meeting-notification.service';
import {
	isMeetingChangeWorthTelling,
	isMeetingScheduled
} from '../../meeting-notifications/meeting-notification.rules';

@CommandHandler(EmployeeAppointmentUpdateCommand)
export class EmployeeAppointmentUpdateHandler implements ICommandHandler<EmployeeAppointmentUpdateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService,
		private employeeService: EmployeeService,
		private organizationService: OrganizationService,
		private meetingNotifications: MeetingNotificationService
	) {}

	public async execute(command?: EmployeeAppointmentUpdateCommand): Promise<UpdateResult | EmployeeAppointment> {
		const { id, employeeAppointmentUpdateRequest: data } = command;
		const employee = data.employeeId ? await this.employeeService.findOneByIdString(data.employeeId) : null;
		const organization = data.organizationId
			? await this.organizationService.findOneByIdString(data.organizationId)
			: null;
		const tenantId = organization?.tenantId ? organization.tenantId : null;
		// `isNotEmpty` also skipped '': keep treating it as "not sent" rather than writing 0 / false
		const isSent = (value: unknown) => value !== undefined && value !== '';
		const newAppointment = {
			...(isNotEmpty(employee) ? { employeeId: employee.id } : {}),
			...(isNotEmpty(organization) ? { organizationId: organization.id } : {}),
			...(isNotEmpty(tenantId) ? { tenantId: organization.tenantId } : {}),
			...(isNotEmpty(data.agenda) ? { agenda: data.agenda } : {}),
			...(isNotEmpty(data['emails']) ? { emails: data['emails'] } : {}),
			...(isNotEmpty(data['status']) ? { status: data['status'] } : {}),
			...(isNotEmpty(data.description) ? { description: data.description } : {}),
			...(isNotEmpty(data.location) ? { location: data.location } : {}),
			...(isNotEmpty(data.breakStartTime) ? { breakStartTime: data.breakStartTime } : {}),
			// `isNotEmpty` treats false and 0 as empty, so switching a buffer off or setting 0 minutes was dropped:
			// only a key left out of the request is skipped (null stays null instead of being coerced to 0)
			...(isSent(data.breakTimeInMins)
				? { breakTimeInMins: data.breakTimeInMins === null ? null : +data.breakTimeInMins }
				: {}),
			...(isSent(data.bufferTimeStart) ? { bufferTimeStart: data.bufferTimeStart } : {}),
			...(isSent(data.bufferTimeEnd) ? { bufferTimeEnd: data.bufferTimeEnd } : {}),
			...(isSent(data.bufferTimeInMins)
				? { bufferTimeInMins: data.bufferTimeInMins === null ? null : +data.bufferTimeInMins }
				: {}),
			...(isNotEmpty(data.startDateTime) ? { startDateTime: data.startDateTime } : {}),
			...(isNotEmpty(data.endDateTime) ? { endDateTime: data.endDateTime } : {})
		};

		// The meeting as it stood, read in the caller's scope (a meeting the caller may not read is not found), for what
		// its invitees are told (ever-co/ever-teams#5022). Only read when the change can concern them.
		const before = await this.meetingBefore(id);
		const inviteeIds: ID[] | undefined =
			data.inviteeEmployeeIds !== undefined && before
				? await this.meetingNotifications.checkedInviteeIdsOf(
						data.inviteeEmployeeIds,
						{
							organizationId: newAppointment.organizationId ?? before.organizationId,
							tenantId: newAppointment.tenantId ?? before.tenantId
						},
						newAppointment.employeeId ?? before.employeeId
				  )
				: undefined;

		const updatedAppointment = await this.employeeAppointmentService.update(id, newAppointment);

		if (before) {
			await this.tellInvitees(before, { ...before, ...newAppointment }, inviteeIds);
		}

		return updatedAppointment;
	}

	/**
	 * The meeting before the update, or null when the caller may not read it (not found in their scope: the update then
	 * answers as before). Any other failure of the read fails the request before anything is written, so an invitee
	 * change it carries is never dropped while the update answers success.
	 */
	private async meetingBefore(id: ID): Promise<IMeetingSnapshot | null> {
		try {
			const appointment = await this.employeeAppointmentService.findOneByIdString(id);
			return {
				id: appointment.id,
				tenantId: appointment.tenantId,
				organizationId: appointment.organizationId,
				employeeId: appointment.employeeId ?? null,
				agenda: appointment.agenda,
				description: appointment.description ?? null,
				location: appointment.location ?? null,
				startDateTime: appointment.startDateTime,
				endDateTime: appointment.endDateTime,
				status: appointment.status ?? null
			};
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Writes the invitees the request named, then tells them what changed: a meeting cancelled now tells everyone who
	 * was invited; otherwise those added are invited, those left out are told they no longer are, and those kept are
	 * told when, where or what the meeting is changed. A meeting that was already cancelled tells nobody anything.
	 */
	private async tellInvitees(before: IMeetingSnapshot, after: IMeetingSnapshot, inviteeIds?: ID[]): Promise<void> {
		const sentByEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? null;
		const invitedBefore = await this.meetingNotifications.inviteeIdsOf(before.id, before.tenantId);
		// The rows are written under the meeting as it is now: an update that moved it to another organization files its new
		// invitees there, where they were checked
		const change = inviteeIds
			? await this.meetingNotifications.replaceInvitees(after, inviteeIds)
			: { added: [], removed: [], kept: invitedBefore };

		if (!isMeetingScheduled(before.status)) {
			return;
		}
		if (after.status === EmployeeAppointmentStatus.CANCELLED) {
			await this.meetingNotifications.notify('cancelled', before, invitedBefore, { sentByEmployeeId });
			return;
		}
		await this.meetingNotifications.notify('invited', after, change.added, { sentByEmployeeId });
		await this.meetingNotifications.notify('removed', before, change.removed, { sentByEmployeeId });
		if (isMeetingChangeWorthTelling(before, after)) {
			await this.meetingNotifications.notify('changed', after, change.kept, { sentByEmployeeId });
		}
	}
}
