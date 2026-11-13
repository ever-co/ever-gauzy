import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, ID, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import {
	Employee,
	EmployeeNotification,
	EmployeeNotificationSetting,
	Task,
	TimeLog
} from '../../core/entities/internal';
import { isUniqueViolation } from '../../core/errors/unique-violation';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { TimeLogReminder } from './time-log-reminder.entity';
import { runInTimerReminderContext } from './timer-reminder-context';
import {
	TIMER_REMINDER_MAX_RUN_AGE_MS,
	TIMER_REMINDER_STALE_CLAIM_MS,
	TIMER_REMINDER_SWEEP_PAGE_SIZE,
	TIMER_REMINDER_SWEEP_TIME_BUDGET_MS
} from './timer-reminder.constants';
import {
	instantOf,
	TimerReminderLevel,
	timerReminderHoursOf,
	timerReminderLevelAt,
	timerReminderNotice
} from './timer-reminder.rules';

/** What one sweep did. */
export interface ITimerReminderSweepReport {
	/** The running time logs read. */
	checked: number;
	/** The reminders filed. */
	reminded: number;
	/** Of those, the ones a process that stopped had claimed and left unfiled. */
	recovered: number;
	/** The reminders that could not be filed; the next sweep tries them again. */
	failed: number;
}

/** A running time log, as the sweep reads it. */
export interface ITimerReminderLogRow {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	employeeId: ID;
	startedAt: Date | string;
	taskTitle: string | null;
}

/**
 * A claim's time, to the second. It is also its holder's token: a process gives a claim back only while the claim still
 * holds the time it wrote, and one that takes a claim over writes its own. MySQL keeps no fraction of a second.
 */
function claimTimeOf(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/** A reminder's claim, as the sweep reads it. */
interface ITimerReminderClaim {
	id: ID;
	level: number;
	employeeNotificationId: ID;
	claimedAt: Date | string;
	filedAt?: Date | string | null;
}

/**
 * Reminds employees of a timer left running (ever-co/ever-teams#5022), even when no Ever Teams tab is open: the timer
 * of the desktop app, a laptop that was closed. Each reminder is one employee notification of type `TimerReminder`
 * about the time log, which the platform's notification pipeline files in the receiver's Inbox and delivers by email
 * and push as their notification preferences say (the email mode of the kind, the push switches, the quiet hours).
 *
 * - **When.** At the employee's threshold (`preferences.timerReminderHours` of their notification setting, 8 hours
 *   when unset, none when `null` or 0) and at twice it, never a third time. A sweep that finds both due at once (the
 *   timer was started before the reminders were switched on, or no sweep ran meanwhile) files the second alone.
 * - **Not for a run nobody is timing.** A run started more than a week ago (TIMER_REMINDER_MAX_RUN_AGE_MS) is a log
 *   nobody stopped: it is left alone, so switching the reminders on does not email every such log at once.
 * - **Once, whatever the processes and their failures.** The sweep inserts a `time_log_reminder` row for the log and
 *   the level before it files the notification, and chooses there the id the notification is filed under. The row is
 *   unique on both, so when several processes sweep at once one insert goes through and the others get a unique
 *   violation and file nothing. The row records when its notification was filed. One left unfiled for a while
 *   (TIMER_REMINDER_STALE_CLAIM_MS: its process stopped in between) is taken over by a later sweep, which files it
 *   under the same id unless a notification of that id exists (written just before the stop), which it then records.
 *   A notification that could not be filed gives its row back for the next sweep, unless it was written after all, or
 *   the row was taken over: the process it was taken from may still write the notification, so the row stays, stale,
 *   and the next takeover files it under the same id or finds it written.
 * - **No needless duplicate.** Every reminder is filed unread. An open Ever Teams tab shows its own reminder (a toast,
 *   or a system notification when it is out of sight) and marks the platform's copy read through the notification API.
 *   The delivery lane holds a timer reminder's email and push a few minutes for that mark, and sends neither once the
 *   reminder is read. A heartbeat cannot tell an open tab from the desktop app or the mobile app, so none is read here.
 * - **Tenant by tenant.** Each notification is filed in a request context of the log's own tenant and organization,
 *   for the log's own employee, whose preferences are read in that tenant: nothing crosses a tenant.
 */
@Injectable()
export class TimerReminderService {
	private readonly logger = new Logger(TimerReminderService.name);

	/**
	 * The last running log the last sweep read. The next sweep resumes after it, and wraps round to the oldest once it
	 * reaches the end, so a list longer than one sweep's budget (the logs of employees who turned the reminders off stay
	 * in it) is read through in turn, not from its start every time. Kept by each process: the claims make two processes
	 * that read the same log harmless.
	 */
	private cursor: ITimerReminderLogRow | null = null;

	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: EmployeeNotificationService
	) {}

	/**
	 * Files the reminders that are due: reads the running time logs a page at a time, in the order they started, from
	 * where the last sweep stopped to the end, then from the oldest round to where it began, until the list is read or
	 * the time budget of the pass is spent.
	 *
	 * @param now The moment the reminders are due at.
	 * @param budgetMs How long the pass may keep reading pages.
	 */
	async sweep(
		now: Date = new Date(),
		budgetMs: number = TIMER_REMINDER_SWEEP_TIME_BUDGET_MS
	): Promise<ITimerReminderSweepReport> {
		const report: ITimerReminderSweepReport = { checked: 0, reminded: 0, recovered: 0, failed: 0 };
		const startedAt = Date.now();
		const start = this.cursor;
		let after = start;
		let hasWrapped = false;

		for (;;) {
			// Once wrapped round to the oldest, the pass reads up to where it began
			const page = await this.runningLogs(after, TIMER_REMINDER_SWEEP_PAGE_SIZE, now, hasWrapped ? start : null);
			report.checked += page.length;
			if (page.length) {
				await this.remindPage(page, now, report);
				after = page[page.length - 1];
				this.cursor = after;
			}
			const isOutOfTime = Date.now() - startedAt >= budgetMs;
			if (page.length < TIMER_REMINDER_SWEEP_PAGE_SIZE) {
				// The end of the list. A pass that began after the oldest log reads the ones before, with the time left.
				if (start !== null && !hasWrapped && !isOutOfTime) {
					hasWrapped = true;
					after = null;
					continue;
				}
				// Read through, or the oldest logs are next: the next pass starts with them
				this.cursor = null;
				break;
			}
			if (isOutOfTime) {
				break;
			}
		}

		if (report.reminded || report.failed) {
			this.logger.log(
				`Timer reminders: ${report.reminded} filed (${report.recovered} left unfiled by a process that stopped), ${report.failed} failed, ${report.checked} running timer(s) read`
			);
		}
		return report;
	}

	/**
	 * A page of the running time logs that may still be due a reminder: running, started within the last week, of an
	 * active employee of the log's own tenant, and whose second reminder is not filed yet. Ordered by start, then id, so
	 * the next page starts after the last row of this one.
	 */
	private async runningLogs(
		after: ITimerReminderLogRow | null,
		limit: number,
		now: Date,
		until: ITimerReminderLogRow | null = null
	): Promise<ITimerReminderLogRow[]> {
		const query = this.dataSource
			.getRepository(TimeLog)
			.createQueryBuilder('log')
			.innerJoin(Employee, 'employee', 'employee.id = log.employeeId AND employee.tenantId = log.tenantId')
			.leftJoin(Task, 'task', 'task.id = log.taskId AND task.tenantId = log.tenantId')
			.select('log.id', 'id')
			.addSelect('log.tenantId', 'tenantId')
			.addSelect('log.organizationId', 'organizationId')
			.addSelect('log.employeeId', 'employeeId')
			.addSelect('log.startedAt', 'startedAt')
			.addSelect('task.title', 'taskTitle')
			.where('log.isRunning = :running', { running: true })
			.andWhere('log.startedAt IS NOT NULL')
			.andWhere('log.startedAt >= :oldestStart', {
				oldestStart: new Date(now.getTime() - TIMER_REMINDER_MAX_RUN_AGE_MS)
			})
			.andWhere('log.tenantId IS NOT NULL')
			.andWhere('log.organizationId IS NOT NULL')
			.andWhere('employee.deletedAt IS NULL')
			.andWhere('employee.isActive = :active', { active: true })
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('employee.isArchived IS NULL')
						.orWhere('employee.isArchived = :archived', { archived: false })
				)
			)
			.andWhere((qb) => {
				const done = qb
					.subQuery()
					.select('1')
					.from(TimeLogReminder, 'reminder')
					.where('reminder.timeLogId = log.id')
					.andWhere('reminder.level = :lastLevel')
					.andWhere('reminder.filedAt IS NOT NULL')
					.getQuery();
				return `NOT EXISTS ${done}`;
			})
			.setParameter('lastLevel', 2)
			.orderBy('log.startedAt', 'ASC')
			.addOrderBy('log.id', 'ASC')
			.limit(limit);
		if (after) {
			query.andWhere(
				new Brackets((next) =>
					next
						.where('log.startedAt > :afterStartedAt', { afterStartedAt: after.startedAt })
						.orWhere('log.startedAt = :afterStartedAt AND log.id > :afterId', { afterId: after.id })
				)
			);
		}
		if (until) {
			query.andWhere(
				new Brackets((upTo) =>
					upTo
						.where('log.startedAt < :untilStartedAt', { untilStartedAt: until.startedAt })
						.orWhere('log.startedAt = :untilStartedAt AND log.id <= :untilId', { untilId: until.id })
				)
			);
		}
		return query.getRawMany<ITimerReminderLogRow>();
	}

	/** Files the reminders a page of running time logs is due, and the ones a stopped process left unfiled. */
	private async remindPage(
		page: ITimerReminderLogRow[],
		now: Date,
		report: ITimerReminderSweepReport
	): Promise<void> {
		const preferences = await this.preferencesOf(page);
		const claims = await this.claimsOf(page.map((log) => log.id));

		for (const log of page) {
			const hours = timerReminderHoursOf(preferences.get(this.employeeKeyOf(log)));
			if (hours === null) {
				continue;
			}
			const level = timerReminderLevelAt(now.getTime() - instantOf(log.startedAt), hours);
			const ofLog = claims.get(String(log.id)) ?? [];
			// None due yet, or a higher one claimed already (the threshold was raised since): nothing to say
			if (level === 0 || ofLog.some((claim) => Number(claim.level) > level)) {
				continue;
			}
			const own = ofLog.find((claim) => Number(claim.level) === level);
			try {
				if (!own) {
					const claim = await this.claim(log, level, now);
					if (claim) {
						await this.file(log, level, hours, claim, now, report, false);
					}
				} else if (!own.filedAt && now.getTime() - instantOf(own.claimedAt) >= TIMER_REMINDER_STALE_CLAIM_MS) {
					// Claimed by a process that stopped before it filed the notification: taken over, and filed under the
					// claim's own id
					if (await this.takeOver(own, now)) {
						await this.file(log, level, hours, own, now, report, true);
					}
				}
			} catch (error) {
				report.failed += 1;
				this.logger.warn(
					`Timer reminder ${level} of time log ${log.id} was not filed: ${(error as Error)?.message ?? error}`
				);
			}
		}
	}

	/**
	 * Files a claimed reminder under the id its claim chose, then records it as filed. A claim taken over looks for a
	 * notification of that id first: the process that stopped may have written it. A notification that could not be
	 * filed gives its claim back, unless it was written after all (a failure past the write), when it is recorded, or
	 * the claim was taken over: that one stays for a later takeover.
	 */
	private async file(
		log: ITimerReminderLogRow,
		level: TimerReminderLevel,
		hours: number,
		claim: ITimerReminderClaim,
		now: Date,
		report: ITimerReminderSweepReport,
		takenOver: boolean
	): Promise<void> {
		if (takenOver && (await this.isFiled(claim.employeeNotificationId, log.tenantId))) {
			await this.recordFiled(claim, now);
			return;
		}
		const { title, message } = timerReminderNotice(level, hours, log.taskTitle);
		const input: IEmployeeNotificationCreateInput & { id: ID } = {
			id: claim.employeeNotificationId,
			title,
			message,
			type: EmployeeNotificationTypeEnum.TIMER_REMINDER,
			entity: BaseEntityEnum.TimeLog,
			entityId: log.id,
			receiverEmployeeId: log.employeeId,
			organizationId: log.organizationId,
			tenantId: log.tenantId
		};
		try {
			await runInTimerReminderContext({ tenantId: log.tenantId, organizationId: log.organizationId }, () =>
				this.notifications.create(input)
			);
		} catch (error) {
			if (!(await this.isFiled(claim.employeeNotificationId, log.tenantId))) {
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
	private async claim(
		log: ITimerReminderLogRow,
		level: TimerReminderLevel,
		now: Date
	): Promise<ITimerReminderClaim | null> {
		const claimedAt = claimTimeOf(now);
		const claim: ITimerReminderClaim = {
			id: randomUUID(),
			level,
			employeeNotificationId: randomUUID(),
			claimedAt
		};
		try {
			await this.dataSource.getRepository(TimeLogReminder).insert({
				id: claim.id,
				tenantId: log.tenantId,
				organizationId: log.organizationId,
				timeLogId: log.id,
				level,
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
	 * Takes over a claim left unfiled past TIMER_REMINDER_STALE_CLAIM_MS: true for the one process whose update wrote its
	 * own time, which the claim then holds as this process's token; false when another took it over first or it was
	 * filed meanwhile.
	 */
	private async takeOver(claim: ITimerReminderClaim, now: Date): Promise<boolean> {
		const claimedAt = claimTimeOf(now);
		const result = await this.dataSource.getRepository(TimeLogReminder).update(
			{
				id: claim.id,
				filedAt: IsNull(),
				claimedAt: LessThanOrEqual(new Date(now.getTime() - TIMER_REMINDER_STALE_CLAIM_MS))
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
	private async recordFiled(claim: ITimerReminderClaim, now: Date): Promise<void> {
		try {
			await this.dataSource.getRepository(TimeLogReminder).update({ id: claim.id }, { filedAt: now });
		} catch (error) {
			this.logger.warn(
				`Timer reminder ${claim.level}'s claim ${claim.id} was not recorded as filed: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/**
	 * Gives back a claim this process inserted, so the next sweep files the reminder: only while it still holds the time
	 * this process wrote. A filing that outlasted TIMER_REMINDER_STALE_CLAIM_MS may have seen its claim taken over
	 * meanwhile; the claim is then the other process's, which files it, and giving it back would let a later sweep file
	 * the reminder a second time.
	 */
	private async release(claim: ITimerReminderClaim): Promise<void> {
		const claimedAt = claim.claimedAt instanceof Date ? claim.claimedAt : new Date(instantOf(claim.claimedAt));
		try {
			await this.dataSource.getRepository(TimeLogReminder).delete({ id: claim.id, claimedAt, filedAt: IsNull() });
		} catch (error) {
			this.logger.warn(
				`The claim ${claim.id} of timer reminder ${claim.level} was not given back: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/** The `preferences` of the employees' notification settings, read in each employee's own tenant. */
	private async preferencesOf(page: ITimerReminderLogRow[]): Promise<Map<string, unknown>> {
		const employeeIds = [...new Set(page.map((log) => String(log.employeeId)))];
		const settings = await this.dataSource.getRepository(EmployeeNotificationSetting).find({
			select: { employeeId: true, tenantId: true, preferences: true },
			where: { employeeId: In(employeeIds) }
		});
		const preferences = new Map<string, unknown>();
		for (const setting of settings) {
			preferences.set(this.employeeKeyOf(setting), setting.preferences);
		}
		return preferences;
	}

	/** The claims of each log. */
	private async claimsOf(timeLogIds: ID[]): Promise<Map<string, ITimerReminderClaim[]>> {
		const rows = await this.dataSource.getRepository(TimeLogReminder).find({
			select: {
				id: true,
				timeLogId: true,
				level: true,
				employeeNotificationId: true,
				claimedAt: true,
				filedAt: true
			},
			where: { timeLogId: In(timeLogIds) }
		});
		const claims = new Map<string, ITimerReminderClaim[]>();
		for (const row of rows) {
			const ofLog = claims.get(String(row.timeLogId)) ?? [];
			ofLog.push({
				id: row.id as ID,
				level: Number(row.level),
				employeeNotificationId: row.employeeNotificationId,
				claimedAt: row.claimedAt,
				filedAt: row.filedAt ?? null
			});
			claims.set(String(row.timeLogId), ofLog);
		}
		return claims;
	}

	private employeeKeyOf(row: { employeeId?: ID | null; tenantId?: ID | null }): string {
		return `${row.tenantId}:${row.employeeId}`;
	}
}
