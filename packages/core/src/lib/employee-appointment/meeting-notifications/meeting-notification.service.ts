import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource, In } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeAppointmentStatus,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeAppointmentInvitation,
	IEmployeeAppointmentInvitationFindInput
} from '@gauzy/contracts';
import { AppointmentEmployee, Employee, EmployeeAppointment, User } from '../../core/entities/internal';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { instantOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';
import { MeetingNoticeKind, meetingNotice } from './meeting-notification.rules';

/** What a meeting notice is about: the appointment as it stands (or stood, for one cancelled by its deletion). */
export interface IMeetingSnapshot {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	/** The employee who hosts it. */
	employeeId?: ID | null;
	agenda?: string | null;
	description?: string | null;
	location?: string | null;
	startDateTime: Date | string;
	endDateTime?: Date | string | null;
	status?: EmployeeAppointmentStatus | string | null;
}

/** The invitees an update added and removed. */
export interface IMeetingInviteeChange {
	added: ID[];
	removed: ID[];
	/** Invited before the update and after it. */
	kept: ID[];
}

/** The most meetings `GET /employee-appointment/invited` answers at once. */
export const MEETING_INVITATIONS_LIMIT = 500;

/**
 * The invitees of a meeting and what they are told (ever-co/ever-teams#5022).
 *
 * A meeting is an employee appointment, hosted by its employee. Its invitees are the employees of its organization in
 * its `appointment_employee` rows; a client names them in `inviteeEmployeeIds` when it writes the appointment. Each
 * invitee is told, with a `Meeting` notification, that they were invited, that they no longer are, that the meeting
 * changed or that it was cancelled. The notification service files it in their Inbox, and the delivery lane emails and
 * pushes it as their preferences say. The reminders before the meeting are the sweep's (`MeetingReminderService`).
 *
 * Notifying is best effort: a notice that could not be filed is logged and never fails the appointment's write.
 */
@Injectable()
export class MeetingNotificationService {
	private readonly logger = new Logger(MeetingNotificationService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: EmployeeNotificationService
	) {}

	/** The employees invited to an appointment, whichever of its two keys their rows name it by. */
	async inviteeIdsOf(appointmentId: ID, tenantId: ID): Promise<ID[]> {
		const rows = await this.dataSource
			.getRepository(AppointmentEmployee)
			.createQueryBuilder('invitee')
			.select('invitee.employeeId', 'employeeId')
			.where('invitee.tenantId = :tenantId', { tenantId })
			.andWhere(
				new Brackets((appointment) =>
					appointment
						.where('invitee.appointmentId = :appointmentId', { appointmentId })
						.orWhere('invitee.employeeAppointmentId = :appointmentId', { appointmentId })
				)
			)
			.getRawMany<{ employeeId: ID | null }>();
		return uniqueIds(rows.map((row) => row.employeeId));
	}

	/**
	 * The invitees a request names, checked: a list of ids of employees of the meeting's organization and tenant,
	 * without repeats and without the host. Anything else is refused before anything is written.
	 *
	 * @throws BadRequestException when the value is not a list of ids, or names someone who is not an employee of the
	 * organization.
	 */
	async checkedInviteeIdsOf(
		value: unknown,
		scope: { organizationId: ID; tenantId: ID },
		hostEmployeeId?: ID | null
	): Promise<ID[]> {
		if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
			throw new BadRequestException('inviteeEmployeeIds must be a list of employee ids.');
		}
		const ids = uniqueIds(value as ID[]).filter((id) => id !== hostEmployeeId);
		if (!ids.length) {
			return [];
		}
		if (!scope.organizationId || !scope.tenantId) {
			throw new BadRequestException('The meeting names no organization to invite its employees from.');
		}
		const found = await this.dataSource.getRepository(Employee).count({
			where: { id: In(ids), organizationId: scope.organizationId, tenantId: scope.tenantId }
		});
		if (found !== ids.length) {
			throw new BadRequestException("Every invitee must be an employee of the meeting's organization.");
		}
		return ids;
	}

	/** Makes the appointment's invitees exactly `ids`, and says who was added and who removed. */
	async replaceInvitees(appointment: IMeetingSnapshot, ids: ID[]): Promise<IMeetingInviteeChange> {
		const current = await this.inviteeIdsOf(appointment.id, appointment.tenantId);
		const wanted = uniqueIds(ids);
		const added = wanted.filter((id) => !current.includes(id));
		const removed = current.filter((id) => !wanted.includes(id));
		const kept = current.filter((id) => wanted.includes(id));

		if (removed.length) {
			const invitees = this.dataSource.getRepository(AppointmentEmployee);
			const ofTenant = { tenantId: appointment.tenantId, employeeId: In(removed) };
			// A row may name the appointment by either key (the Angular app writes both, older rows the first only)
			await invitees.delete({ ...ofTenant, appointmentId: appointment.id });
			await invitees.delete({ ...ofTenant, employeeAppointmentId: appointment.id });
		}
		if (added.length) {
			await this.dataSource.getRepository(AppointmentEmployee).insert(
				added.map((employeeId) => ({
					appointmentId: appointment.id,
					employeeAppointmentId: appointment.id,
					employeeId,
					tenantId: appointment.tenantId,
					organizationId: appointment.organizationId
				}))
			);
		}
		return { added, removed, kept };
	}

	/**
	 * Tells each receiver about the meeting with a `Meeting` notification, its time in their own time zone. The one who
	 * made the change is not told about it. A meeting that ended already is worth no notice at all.
	 *
	 * @returns How many notices were filed.
	 */
	async notify(
		kind: MeetingNoticeKind,
		meeting: IMeetingSnapshot,
		receiverIds: ID[],
		options: { sentByEmployeeId?: ID | null; now?: number } = {}
	): Promise<number> {
		const now = options.now ?? Date.now();
		const receivers = uniqueIds(receiverIds).filter((id) => id !== options.sentByEmployeeId);
		if (!receivers.length || hasEnded(meeting, now)) {
			return 0;
		}
		let timeZones = new Map<string, string | null>();
		try {
			timeZones = await this.timeZonesOf(receivers, meeting.tenantId);
		} catch (error) {
			this.logger.warn(`The time zones of a meeting's invitees were not read: ${(error as Error)?.message ?? error}`);
		}
		let filed = 0;
		for (const receiverEmployeeId of receivers) {
			const { title, message } = meetingNotice(kind, {
				agenda: meeting.agenda,
				startDateTime: meeting.startDateTime,
				endDateTime: meeting.endDateTime,
				timeZone: timeZones.get(receiverEmployeeId) ?? null,
				now
			});
			try {
				await this.notifications.create({
					title,
					message,
					type: EmployeeNotificationTypeEnum.MEETING,
					entity: BaseEntityEnum.EmployeeAppointment,
					entityId: meeting.id,
					receiverEmployeeId,
					...(options.sentByEmployeeId ? { sentByEmployeeId: options.sentByEmployeeId } : {}),
					organizationId: meeting.organizationId,
					tenantId: meeting.tenantId
				});
				filed += 1;
			} catch (error) {
				this.logger.warn(
					`The ${kind} notice of meeting ${meeting.id} was not filed for employee ${receiverEmployeeId}: ${
						(error as Error)?.message ?? error
					}`
				);
			}
		}
		return filed;
	}

	/** The time zone of each employee's user, in the tenant. */
	async timeZonesOf(employeeIds: ID[], tenantId: ID): Promise<Map<string, string | null>> {
		const zones = new Map<string, string | null>();
		if (!employeeIds.length) {
			return zones;
		}
		const rows = await this.dataSource
			.getRepository(Employee)
			.createQueryBuilder('employee')
			.innerJoin(User, 'user', 'user.id = employee.userId')
			.select('employee.id', 'employeeId')
			.addSelect('user.timeZone', 'timeZone')
			.where('employee.id IN (:...employeeIds)', { employeeIds })
			.andWhere('employee.tenantId = :tenantId', { tenantId })
			.getRawMany<{ employeeId: ID; timeZone: string | null }>();
		for (const row of rows) {
			zones.set(String(row.employeeId), row.timeZone ?? null);
		}
		return zones;
	}

	/**
	 * The meetings an employee is invited to, in their tenant, by start time: those neither cancelled nor deleted, that
	 * run within the range when one is given (a meeting that overlaps it counts), each with the name of its host.
	 */
	async invitationsOf(
		employeeId: ID,
		tenantId: ID,
		range: IEmployeeAppointmentInvitationFindInput = {}
	): Promise<IEmployeeAppointmentInvitation[]> {
		const startDate = dateOf(range.startDate, 'startDate');
		const endDate = dateOf(range.endDate, 'endDate');
		const query = this.dataSource
			.getRepository(EmployeeAppointment)
			.createQueryBuilder('appointment')
			.innerJoin(
				AppointmentEmployee,
				'invitee',
				'invitee.tenantId = appointment.tenantId AND (invitee.appointmentId = appointment.id OR invitee.employeeAppointmentId = appointment.id)'
			)
			.leftJoin(Employee, 'host', 'host.id = appointment.employeeId AND host.tenantId = appointment.tenantId')
			.leftJoin(User, 'hostUser', 'hostUser.id = host.userId')
			.select('appointment.id', 'id')
			.addSelect('appointment.agenda', 'agenda')
			.addSelect('appointment.description', 'description')
			.addSelect('appointment.location', 'location')
			.addSelect('appointment.startDateTime', 'startDateTime')
			.addSelect('appointment.endDateTime', 'endDateTime')
			.addSelect('appointment.status', 'status')
			.addSelect('appointment.organizationId', 'organizationId')
			.addSelect('appointment.employeeId', 'hostEmployeeId')
			.addSelect('hostUser.firstName', 'hostFirstName')
			.addSelect('hostUser.lastName', 'hostLastName')
			.addSelect('hostUser.email', 'hostEmail')
			.where('invitee.employeeId = :employeeId', { employeeId })
			.andWhere('appointment.tenantId = :tenantId', { tenantId })
			.andWhere(
				new Brackets((status) =>
					status
						.where('appointment.status IS NULL')
						.orWhere('appointment.status != :cancelled', { cancelled: EmployeeAppointmentStatus.CANCELLED })
				)
			)
			.orderBy('appointment.startDateTime', 'ASC')
			.addOrderBy('appointment.id', 'ASC')
			.limit(MEETING_INVITATIONS_LIMIT);
		if (startDate) {
			query.andWhere('appointment.endDateTime > :startDate', { startDate });
		}
		if (endDate) {
			query.andWhere('appointment.startDateTime < :endDate', { endDate });
		}
		const rows = await query.getRawMany<{
			id: ID;
			agenda: string;
			description: string | null;
			location: string | null;
			startDateTime: Date | string;
			endDateTime: Date | string;
			status: EmployeeAppointmentStatus | null;
			organizationId: ID;
			hostEmployeeId: ID | null;
			hostFirstName: string | null;
			hostLastName: string | null;
			hostEmail: string | null;
		}>();
		// One row per invitation row: an employee named twice (by both keys) reads the meeting once
		const seen = new Set<string>();
		const invitations: IEmployeeAppointmentInvitation[] = [];
		for (const row of rows) {
			if (seen.has(String(row.id))) {
				continue;
			}
			seen.add(String(row.id));
			const name = [row.hostFirstName, row.hostLastName].filter((part) => part && part.trim()).join(' ').trim();
			invitations.push({
				id: row.id,
				agenda: row.agenda,
				description: row.description ?? null,
				location: row.location ?? null,
				startDateTime: new Date(instantOf(row.startDateTime)),
				endDateTime: new Date(instantOf(row.endDateTime)),
				status: row.status ?? null,
				organizationId: row.organizationId,
				host: { employeeId: row.hostEmployeeId ?? null, name: name || row.hostEmail || null }
			});
		}
		return invitations;
	}
}

/** Ids, as strings, without empties and repeats, in their first order. */
function uniqueIds(ids: Array<ID | null | undefined>): ID[] {
	return [...new Set(ids.filter((id): id is ID => typeof id === 'string' && id.length > 0))];
}

/** Whether the meeting is over at `now`: its end, else its start, has passed. */
function hasEnded(meeting: IMeetingSnapshot, now: number): boolean {
	const end = meeting.endDateTime ? instantOf(meeting.endDateTime) : Number.NaN;
	const last = Number.isFinite(end) ? end : instantOf(meeting.startDateTime);
	return Number.isFinite(last) && last <= now;
}

/** A date of the range, or undefined when none is given. */
function dateOf(value: Date | string | undefined, name: string): Date | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`${name} must be a date.`);
	}
	return date;
}
