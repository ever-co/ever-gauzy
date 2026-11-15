import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeAppointmentStatus,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotificationCreateInput
} from '@gauzy/contracts';
import {
	AppointmentEmployee,
	Employee,
	EmployeeAppointment,
	EmployeeNotification,
	EmployeeNotificationSetting,
	User
} from '../../core/entities/internal';
import { isUniqueViolation } from '../../core/errors/unique-violation';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { instantOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';
import { EmployeeAppointmentReminder } from './employee-appointment-reminder.entity';
import { runInMeetingReminderContext } from './meeting-reminder-context';
import {
	MEETING_REMINDER_STALE_CLAIM_MS,
	MEETING_REMINDER_SWEEP_PAGE_SIZE,
	MEETING_REMINDER_SWEEP_TIME_BUDGET_MS
} from './meeting-reminder.constants';
import {
	MAX_MEETING_REMINDER_MINUTES,
	MEETING_STARTING_GRACE_MS,
	MeetingReminderLevel,
	meetingNotice,
	meetingReminderLevelAt,
	meetingReminderMinutesOf
} from './meeting-notification.rules';

/** What one sweep did. */
export interface IMeetingReminderSweepReport {
	/** The meetings read. */
	checked: number;
	/** The reminders filed. */
	reminded: number;
	/** Of those, the ones a process that stopped had claimed and left unfiled. */
	recovered: number;
	/** The reminders that could not be filed; the next sweep tries them again while they are due. */
	failed: number;
}

/** A meeting starting soon, as the sweep reads it. */
export interface IMeetingReminderRow {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	agenda: string | null;
	startDateTime: Date | string;
	endDateTime: Date | string | null;
	/** Its host, when the host is an active employee of its tenant. */
	hostEmployeeId: ID | null;
}

/** A reminder's claim, as the sweep reads it. */
interface IMeetingReminderClaim {
	id: ID;
	employeeId: ID;
	level: number;
	startDateTime: Date | string;
	employeeNotificationId: ID;
	claimedAt: Date | string;
	filedAt?: Date | string | null;
}

/** One reminder to file: a meeting, someone it concerns, and the level due. */
interface IMeetingReminderDue {
	meeting: IMeetingReminderRow;
	employeeId: ID;
	level: MeetingReminderLevel;
	timeZone: string | null;
}

/**
 * A claim's time, to the second. It is also its holder's token: a process gives a claim back only while the claim still
 * holds the time it wrote, and one that takes a claim over writes its own. MySQL keeps no fraction of a second.
 */
function claimTimeOf(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/**
 * Reminds the host and the invitees of a meeting (an employee appointment) before it starts, and when it is about to
 * (ever-co/ever-teams#5022). Each reminder is one employee notification of type `Meeting` about the appointment, which
 * the notification pipeline files in the receiver's Inbox and delivers by email and push as their notification
 * preferences say.
 *
 * - **When.** At the employee's lead before the start (`preferences.meetingReminderMinutes` of their notification
 *   setting, 15 minutes when unset, none when `null` or 0), and a minute before the start. A sweep that finds both due
 *   at once (the meeting was booked inside the lead, or no sweep ran meanwhile) files the second alone. A meeting that
 *   started more than five minutes ago is past reminding.
 * - **Whom.** Its host and its invitees, while they are active employees of its tenant. A meeting cancelled, marked
 *   completed or deleted reminds nobody.
 * - **A meeting moved.** The start is part of each reminder's key: a meeting moved to another time is reminded of at
 *   its new time, and the reminder of its old time, never due any more, is never filed.
 * - **Once, whatever the processes and their failures.** The sweep inserts an `employee_appointment_reminder` row for
 *   the meeting, the employee, the level and the start before it files the notification, and chooses there the id the
 *   notification is filed under. The row is unique on the four, so when several processes sweep at once one insert goes
 *   through and the others file nothing. A row left unfiled for a while (MEETING_REMINDER_STALE_CLAIM_MS: its process
 *   stopped in between) is taken over by a later sweep, which files it under the same id unless a notification of that
 *   id exists, which it then records. A notification that could not be filed gives its row back for the next sweep,
 *   unless it was written after all, or the row was taken over.
 * - **Tenant by tenant.** Each notification is filed in a request context of the meeting's own tenant and
 *   organization, for an employee of that tenant, whose preferences and time zone are read there.
 */
@Injectable()
export class MeetingReminderService {
	private readonly logger = new Logger(MeetingReminderService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: EmployeeNotificationService
	) {}

	/**
	 * Files the reminders that are due: reads the meetings that may be due one (from five minutes ago to the longest
	 * lead ahead), a page at a time by start, until they are read or the time budget of the pass is spent.
	 *
	 * @param now The moment the reminders are due at.
	 * @param budgetMs How long the pass may keep reading pages.
	 */
	async sweep(
		now: Date = new Date(),
		budgetMs: number = MEETING_REMINDER_SWEEP_TIME_BUDGET_MS
	): Promise<IMeetingReminderSweepReport> {
		const report: IMeetingReminderSweepReport = { checked: 0, reminded: 0, recovered: 0, failed: 0 };
		const startedAt = Date.now();
		let after: IMeetingReminderRow | null = null;

		for (;;) {
			const page = await this.meetingsStartingSoon(after, MEETING_REMINDER_SWEEP_PAGE_SIZE, now);
			report.checked += page.length;
			if (page.length) {
				await this.remindPage(page, now, report);
				after = page[page.length - 1];
			}
			if (page.length < MEETING_REMINDER_SWEEP_PAGE_SIZE || Date.now() - startedAt >= budgetMs) {
				break;
			}
		}

		if (report.reminded || report.failed) {
			this.logger.log(
				`Meeting reminders: ${report.reminded} filed (${report.recovered} left unfiled by a process that stopped), ${report.failed} failed, ${report.checked} meeting(s) read`
			);
		}
		return report;
	}

	/**
	 * A page of the meetings that may be due a reminder: starting between five minutes ago and the longest lead ahead,
	 * neither cancelled nor completed (nor deleted), of an organization of a tenant. Ordered by start, then id, so the
	 * next page starts after the last row of this one.
	 */
	private async meetingsStartingSoon(
		after: IMeetingReminderRow | null,
		limit: number,
		now: Date
	): Promise<IMeetingReminderRow[]> {
		const query = this.dataSource
			.getRepository(EmployeeAppointment)
			.createQueryBuilder('appointment')
			.leftJoin(
				Employee,
				'host',
				'host.id = appointment.employeeId AND host.tenantId = appointment.tenantId AND host.deletedAt IS NULL AND host.isActive = :active AND (host.isArchived IS NULL OR host.isArchived = :archived)',
				{ active: true, archived: false }
			)
			.select('appointment.id', 'id')
			.addSelect('appointment.tenantId', 'tenantId')
			.addSelect('appointment.organizationId', 'organizationId')
			.addSelect('appointment.agenda', 'agenda')
			.addSelect('appointment.startDateTime', 'startDateTime')
			.addSelect('appointment.endDateTime', 'endDateTime')
			.addSelect('host.id', 'hostEmployeeId')
			.where('appointment.startDateTime >= :earliest', {
				earliest: new Date(now.getTime() - MEETING_STARTING_GRACE_MS)
			})
			.andWhere('appointment.startDateTime <= :latest', {
				latest: new Date(now.getTime() + MAX_MEETING_REMINDER_MINUTES * 60 * 1000)
			})
			.andWhere('appointment.tenantId IS NOT NULL')
			.andWhere('appointment.organizationId IS NOT NULL')
			.andWhere(
				new Brackets((status) =>
					status
						.where('appointment.status IS NULL')
						.orWhere('appointment.status NOT IN (:...over)', {
							over: [EmployeeAppointmentStatus.CANCELLED, EmployeeAppointmentStatus.COMPLETED]
						})
				)
			)
			.orderBy('appointment.startDateTime', 'ASC')
			.addOrderBy('appointment.id', 'ASC')
			.limit(limit);
		if (after) {
			query.andWhere(
				new Brackets((next) =>
					next
						.where('appointment.startDateTime > :afterStart', { afterStart: after.startDateTime })
						.orWhere('appointment.startDateTime = :afterStart AND appointment.id > :afterId', {
							afterId: after.id
						})
				)
			);
		}
		return query.getRawMany<IMeetingReminderRow>();
	}

	/** Files the reminders a page of meetings is due, and the ones a stopped process left unfiled. */
	private async remindPage(
		page: IMeetingReminderRow[],
		now: Date,
		report: IMeetingReminderSweepReport
	): Promise<void> {
		const attendees = await this.attendeesOf(page);
		const employeeIds = [...new Set([...attendees.values()].flat())];
		if (!employeeIds.length) {
			return;
		}
		const preferences = await this.preferencesOf(employeeIds);
		const timeZones = await this.timeZonesOf(employeeIds);
		const claims = await this.claimsOf(page.map((meeting) => meeting.id));

		for (const meeting of page) {
			const start = instantOf(meeting.startDateTime);
			for (const employeeId of attendees.get(String(meeting.id)) ?? []) {
				const minutes = meetingReminderMinutesOf(preferences.get(`${meeting.tenantId}:${employeeId}`));
				const level = meetingReminderLevelAt(now.getTime(), start, minutes);
				if (level === 0) {
					continue;
				}
				// The claims of this meeting's current start, for this employee: those of an earlier start are history
				const own = (claims.get(String(meeting.id)) ?? []).filter(
					(claim) => String(claim.employeeId) === String(employeeId) && instantOf(claim.startDateTime) === start
				);
				// A higher one claimed already (the lead was shortened since): nothing to say
				if (own.some((claim) => Number(claim.level) > level)) {
					continue;
				}
				const claimed = own.find((claim) => Number(claim.level) === level);
				const due: IMeetingReminderDue = {
					meeting,
					employeeId,
					level,
					timeZone: timeZones.get(String(employeeId)) ?? null
				};
				try {
					if (!claimed) {
						const claim = await this.claim(due, now);
						if (claim) {
							await this.file(due, claim, now, report, false);
						}
					} else if (
						!claimed.filedAt &&
						now.getTime() - instantOf(claimed.claimedAt) >= MEETING_REMINDER_STALE_CLAIM_MS
					) {
						// Claimed by a process that stopped before it filed the notification: taken over, and filed under
						// the claim's own id
						if (await this.takeOver(claimed, now)) {
							await this.file(due, claimed, now, report, true);
						}
					}
				} catch (error) {
					report.failed += 1;
					this.logger.warn(
						`Meeting reminder ${level} of meeting ${meeting.id} for employee ${employeeId} was not filed: ${
							(error as Error)?.message ?? error
						}`
					);
				}
			}
		}
	}

	/**
	 * Files a claimed reminder under the id its claim chose, then records it as filed. A claim taken over looks for a
	 * notification of that id first: the process that stopped may have written it. A notification that could not be
	 * filed gives its claim back, unless it was written after all, when it is recorded, or the claim was taken over.
	 */
	private async file(
		due: IMeetingReminderDue,
		claim: IMeetingReminderClaim,
		now: Date,
		report: IMeetingReminderSweepReport,
		takenOver: boolean
	): Promise<void> {
		const { meeting } = due;
		if (takenOver && (await this.isFiled(claim.employeeNotificationId, meeting.tenantId))) {
			await this.recordFiled(claim, now);
			return;
		}
		const { title, message } = meetingNotice(due.level === 1 ? 'reminder' : 'starting', {
			agenda: meeting.agenda,
			startDateTime: meeting.startDateTime,
			endDateTime: meeting.endDateTime,
			timeZone: due.timeZone,
			now: now.getTime()
		});
		const input: IEmployeeNotificationCreateInput & { id: ID } = {
			id: claim.employeeNotificationId,
			title,
			message,
			type: EmployeeNotificationTypeEnum.MEETING,
			entity: BaseEntityEnum.EmployeeAppointment,
			entityId: meeting.id,
			receiverEmployeeId: due.employeeId,
			organizationId: meeting.organizationId,
			tenantId: meeting.tenantId
		};
		try {
			await runInMeetingReminderContext({ tenantId: meeting.tenantId, organizationId: meeting.organizationId }, () =>
				this.notifications.create(input)
			);
		} catch (error) {
			if (!(await this.isFiled(claim.employeeNotificationId, meeting.tenantId))) {
				// Only a claim this process inserted is given back. One it took over stays, to be taken over again once
				// stale: the process it was taken from may still be filing, under the claim's id, which that sweep finds.
				if (!takenOver) {
					await this.release(claim);
				}
				throw error;
			}
		}
		await this.recordFiled(claim, now);
		report.reminded += 1;
		if (takenOver) {
			report.recovered += 1;
		}
	}

	/**
	 * Inserts the reminder's claim, naming the id its notification is filed under: the claim, or null when another
	 * process claimed it first.
	 */
	private async claim(due: IMeetingReminderDue, now: Date): Promise<IMeetingReminderClaim | null> {
		const claimedAt = claimTimeOf(now);
		const startDateTime = new Date(instantOf(due.meeting.startDateTime));
		const claim: IMeetingReminderClaim = {
			id: randomUUID(),
			employeeId: due.employeeId,
			level: due.level,
			startDateTime,
			employeeNotificationId: randomUUID(),
			claimedAt
		};
		try {
			await this.dataSource.getRepository(EmployeeAppointmentReminder).insert({
				id: claim.id,
				tenantId: due.meeting.tenantId,
				organizationId: due.meeting.organizationId,
				employeeAppointmentId: due.meeting.id,
				employeeId: due.employeeId,
				level: due.level,
				startDateTime,
				employeeNotificationId: claim.employeeNotificationId,
				claimedAt
			});
			return claim;
		} catch (error) {
			if (isUniqueViolation(error)) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Takes over a claim left unfiled past MEETING_REMINDER_STALE_CLAIM_MS: true for the one process whose update wrote
	 * its own time, which the claim then holds as this process's token; false when another took it over first or it was
	 * filed meanwhile.
	 */
	private async takeOver(claim: IMeetingReminderClaim, now: Date): Promise<boolean> {
		const claimedAt = claimTimeOf(now);
		const result = await this.dataSource.getRepository(EmployeeAppointmentReminder).update(
			{
				id: claim.id,
				filedAt: IsNull(),
				claimedAt: LessThanOrEqual(new Date(now.getTime() - MEETING_REMINDER_STALE_CLAIM_MS))
			},
			{ claimedAt }
		);
		if (result.affected !== 1) {
			return false;
		}
		claim.claimedAt = claimedAt;
		return true;
	}

	/** Whether a notification of that id exists in the tenant, deleted since or not. */
	private async isFiled(notificationId: ID, tenantId: ID): Promise<boolean> {
		const found = await this.dataSource
			.getRepository(EmployeeNotification)
			.createQueryBuilder('notification')
			.withDeleted()
			.select('notification.id', 'id')
			.where('notification.id = :notificationId', { notificationId })
			.andWhere('notification.tenantId = :tenantId', { tenantId })
			.getRawOne();
		return !!found;
	}

	/** Records the claim's notification as filed. If that fails, a later sweep finds the notification by its id. */
	private async recordFiled(claim: IMeetingReminderClaim, now: Date): Promise<void> {
		try {
			await this.dataSource.getRepository(EmployeeAppointmentReminder).update({ id: claim.id }, { filedAt: now });
		} catch (error) {
			this.logger.warn(
				`Meeting reminder ${claim.level}'s claim ${claim.id} was not recorded as filed: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/**
	 * Gives back a claim this process inserted, so the next sweep files the reminder: only while it still holds the time
	 * this process wrote (a filing that outlasted MEETING_REMINDER_STALE_CLAIM_MS may have seen it taken over).
	 */
	private async release(claim: IMeetingReminderClaim): Promise<void> {
		const claimedAt = claim.claimedAt instanceof Date ? claim.claimedAt : new Date(instantOf(claim.claimedAt));
		try {
			await this.dataSource
				.getRepository(EmployeeAppointmentReminder)
				.delete({ id: claim.id, claimedAt, filedAt: IsNull() });
		} catch (error) {
			this.logger.warn(
				`The claim ${claim.id} of meeting reminder ${claim.level} was not given back: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/**
	 * Who each meeting concerns: its host, and its invitees that are active employees of its tenant, without repeats.
	 * An invitation row may name its meeting by either key.
	 */
	private async attendeesOf(page: IMeetingReminderRow[]): Promise<Map<string, ID[]>> {
		const byId = new Map(page.map((meeting) => [String(meeting.id), meeting]));
		const ids = [...byId.keys()];
		const rows = await this.dataSource
			.getRepository(AppointmentEmployee)
			.createQueryBuilder('invitee')
			.innerJoin(Employee, 'employee', 'employee.id = invitee.employeeId AND employee.tenantId = invitee.tenantId')
			.select('invitee.appointmentId', 'appointmentId')
			.addSelect('invitee.employeeAppointmentId', 'employeeAppointmentId')
			.addSelect('invitee.employeeId', 'employeeId')
			.addSelect('invitee.tenantId', 'tenantId')
			.where(
				new Brackets((key) =>
					key
						// Two parameter lists: the first key is a text column on PostgreSQL, the second a uuid
						.where('invitee.appointmentId IN (:...keys)', { keys: ids })
						.orWhere('invitee.employeeAppointmentId IN (:...ids)', { ids })
				)
			)
			.andWhere('employee.deletedAt IS NULL')
			.andWhere('employee.isActive = :active', { active: true })
			.andWhere(
				new Brackets((archived) =>
					archived.where('employee.isArchived IS NULL').orWhere('employee.isArchived = :archived', {
						archived: false
					})
				)
			)
			.getRawMany<{ appointmentId: ID | null; employeeAppointmentId: ID | null; employeeId: ID; tenantId: ID }>();

		const attendees = new Map<string, ID[]>();
		const add = (meetingId: string, employeeId: ID | null | undefined) => {
			if (!employeeId) {
				return;
			}
			const list = attendees.get(meetingId) ?? [];
			if (!list.includes(employeeId)) {
				list.push(employeeId);
			}
			attendees.set(meetingId, list);
		};
		for (const meeting of page) {
			add(String(meeting.id), meeting.hostEmployeeId);
		}
		for (const row of rows) {
			for (const key of [row.appointmentId, row.employeeAppointmentId]) {
				const meeting = key ? byId.get(String(key)) : undefined;
				// Only a row of the meeting's own tenant counts
				if (meeting && String(meeting.tenantId) === String(row.tenantId)) {
					add(String(meeting.id), row.employeeId);
				}
			}
		}
		return attendees;
	}

	/** The `preferences` of the employees' notification settings, by tenant and employee. */
	private async preferencesOf(employeeIds: ID[]): Promise<Map<string, unknown>> {
		const settings = await this.dataSource.getRepository(EmployeeNotificationSetting).find({
			select: { employeeId: true, tenantId: true, preferences: true },
			where: { employeeId: In(employeeIds) }
		});
		const preferences = new Map<string, unknown>();
		for (const setting of settings) {
			preferences.set(`${setting.tenantId}:${setting.employeeId}`, setting.preferences);
		}
		return preferences;
	}

	/** The time zone of each employee's user. */
	private async timeZonesOf(employeeIds: ID[]): Promise<Map<string, string | null>> {
		const rows = await this.dataSource
			.getRepository(Employee)
			.createQueryBuilder('employee')
			.innerJoin(User, 'user', 'user.id = employee.userId')
			.select('employee.id', 'employeeId')
			.addSelect('user.timeZone', 'timeZone')
			.where('employee.id IN (:...employeeIds)', { employeeIds })
			.getRawMany<{ employeeId: ID; timeZone: string | null }>();
		return new Map(rows.map((row) => [String(row.employeeId), row.timeZone ?? null]));
	}

	/** The claims of each meeting. */
	private async claimsOf(meetingIds: ID[]): Promise<Map<string, IMeetingReminderClaim[]>> {
		const rows = await this.dataSource.getRepository(EmployeeAppointmentReminder).find({
			select: {
				id: true,
				employeeAppointmentId: true,
				employeeId: true,
				level: true,
				startDateTime: true,
				employeeNotificationId: true,
				claimedAt: true,
				filedAt: true
			},
			where: { employeeAppointmentId: In(meetingIds) }
		});
		const claims = new Map<string, IMeetingReminderClaim[]>();
		for (const row of rows) {
			const ofMeeting = claims.get(String(row.employeeAppointmentId)) ?? [];
			ofMeeting.push({
				id: row.id as ID,
				employeeId: row.employeeId,
				level: Number(row.level),
				startDateTime: row.startDateTime,
				employeeNotificationId: row.employeeNotificationId,
				claimedAt: row.claimedAt,
				filedAt: row.filedAt ?? null
			});
			claims.set(String(row.employeeAppointmentId), ofMeeting);
		}
		return claims;
	}
}
