import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotificationCreateInput,
	TaskStatusEnum
} from '@gauzy/contracts';
import {
	EmployeeNotification,
	EmployeeNotificationSetting,
	Task,
	TaskStatus,
	User
} from '../../core/entities/internal';
import { isUniqueViolation } from '../../core/errors/unique-violation';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { runInTimerReminderContext } from '../../time-tracking/timer-reminder/timer-reminder-context';
import { instantOf, notificationPreferencesOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';
import { TaskDueReminder } from './task-due-reminder.entity';
import {
	TASK_DUE_REMINDER_STALE_CLAIM_MS,
	TASK_DUE_REMINDER_SWEEP_PAGE_SIZE,
	TASK_DUE_REMINDER_SWEEP_TIME_BUDGET_MS
} from './task-due-reminder.constants';
import {
	isTaskDueReminderDue,
	MAX_TASK_DUE_REMINDER_HOURS,
	taskDueMomentOf,
	taskDueReminderHoursOf,
	taskDueReminderNotice
} from './task-due-reminder.rules';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How far before now a stored due date may lie and still be due later: a day-only due date (midnight UTC) is due once
 * its day is over in the person's zone, up to 36 hours later west of UTC. A little more, for the zones beyond.
 */
const DAY_ONLY_LATEST_DUE_MS = 38 * HOUR_MS;

/** The statuses of a task that is no longer worked on: it is not reminded of. */
const FINISHED_STATUSES: ReadonlyArray<string> = [
	TaskStatusEnum.DONE,
	TaskStatusEnum.COMPLETED,
	TaskStatusEnum.CANCELLED
];

/** What one sweep did. */
export interface ITaskDueReminderSweepReport {
	/** The task assignments read. */
	checked: number;
	/** The reminders filed. */
	reminded: number;
	/** Of those, the ones a process that stopped had claimed and left unfiled. */
	recovered: number;
	/** The reminders that could not be filed; the next sweep tries them again. */
	failed: number;
}

/** An assignee of a task due soon, as the sweep reads it. */
export interface ITaskDueReminderRow {
	taskId: ID;
	taskTitle: string | null;
	dueDate: Date | string;
	tenantId: ID;
	organizationId: ID;
	employeeId: ID;
	userTimeZone: string | null;
}

/** A reminder's claim, as the sweep reads it. */
interface ITaskDueReminderClaim {
	id: ID;
	employeeNotificationId: ID;
	claimedAt: Date | string;
	filedAt?: Date | string | null;
}

/**
 * A claim's time, to the second. It is also its holder's token: a process gives a claim back only while the claim still
 * holds the time it wrote, and one that takes a claim over writes its own. MySQL keeps no fraction of a second.
 */
function claimTimeOf(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/**
 * Reminds the assignees of a task that its due date is near (ever-co/ever-teams#5022). Each reminder is one employee
 * notification of type `TaskDueReminder` about the task, which the platform's notification pipeline files in the
 * receiver's Inbox and delivers by email and push as their notification preferences say.
 *
 * - **When.** Once the task is due in less than the employee's threshold (`preferences.taskDueReminderHours` of their
 *   notification setting, 24 hours when unset, none when `null` or 0), and not after it is due. A due date that names
 *   a day (the date-only form Ever Teams saves, midnight UTC) is due once that day is over in the employee's time zone
 *   (their quiet hours' zone, else their user's, else UTC), so "due Friday" is still open all of their Friday.
 * - **Only for open work.** A task that is done, completed or cancelled (its status, or a status of the task's own list
 *   marked done), archived, a draft or deleted is not reminded of; neither is an assignee who left, nor an archived one.
 * - **Once per due date, whatever the processes.** The sweep inserts a `task_due_reminder` row for the task, the
 *   employee and the due date before it files the notification, and chooses there the id the notification is filed
 *   under. The row is unique on the three, so when several processes sweep at once one insert goes through. A row left
 *   unfiled for a while (its process stopped in between) is taken over by a later sweep, which files it under the same
 *   id unless a notification of that id exists. A due date moved since is a new row, so it is reminded of again.
 * - **Tenant by tenant.** Each notification is filed in a request context of the task's own tenant and organization,
 *   for the assignee, whose preferences are read in that tenant: nothing crosses a tenant.
 */
@Injectable()
export class TaskDueReminderService {
	private readonly logger = new Logger(TaskDueReminderService.name);

	/**
	 * The last assignment the last sweep read. The next sweep resumes after it, and wraps round to the earliest once it
	 * reaches the end, so a list longer than one sweep's budget (the assignments of people who turned the reminders off,
	 * or whose threshold is not reached, stay in it) is read through in turn, not from its start every time. Kept by
	 * each process: the claims make two processes that read the same assignment harmless.
	 */
	private cursor: ITaskDueReminderRow | null = null;

	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: EmployeeNotificationService
	) {}

	/**
	 * Files the reminders that are due: reads the assignees of the tasks due soon a page at a time, in due date order,
	 * from where the last sweep stopped to the end, then from the earliest round to where it began, until the list is
	 * read or the time budget of the pass is spent.
	 *
	 * @param now The moment the reminders are due at. Unset (the schedule's sweeps), the clock is read again for each
	 * page and each reminder, so a reminder reached late in a long pass is judged, and worded, at its own moment: a task
	 * that fell due meanwhile is not reminded of as still to come.
	 * @param budgetMs How long the pass may keep reading pages.
	 */
	async sweep(
		now?: Date,
		budgetMs: number = TASK_DUE_REMINDER_SWEEP_TIME_BUDGET_MS
	): Promise<ITaskDueReminderSweepReport> {
		const clock = (): Date => now ?? new Date();
		const report: ITaskDueReminderSweepReport = { checked: 0, reminded: 0, recovered: 0, failed: 0 };
		const startedAt = Date.now();
		const start = this.cursor;
		let after = start;
		let hasWrapped = false;

		for (;;) {
			// Once wrapped round to the earliest, the pass reads up to where it began
			const page = await this.assigneesOfTasksDueSoon(
				after,
				TASK_DUE_REMINDER_SWEEP_PAGE_SIZE,
				clock(),
				hasWrapped ? start : null
			);
			report.checked += page.length;
			if (page.length) {
				await this.remindPage(page, clock, report);
				after = page[page.length - 1];
				this.cursor = after;
			}
			const isOutOfTime = Date.now() - startedAt >= budgetMs;
			if (page.length < TASK_DUE_REMINDER_SWEEP_PAGE_SIZE) {
				// The end of the list. A pass that began after the earliest reads the ones before, with the time left.
				if (start !== null && !hasWrapped && !isOutOfTime) {
					hasWrapped = true;
					after = null;
					continue;
				}
				// Read through, or the earliest are next: the next pass starts with them
				this.cursor = null;
				break;
			}
			if (isOutOfTime) {
				break;
			}
		}

		if (report.reminded || report.failed) {
			this.logger.log(
				`Task due reminders: ${report.reminded} filed (${report.recovered} left unfiled by a process that stopped), ${report.failed} failed, ${report.checked} assignment(s) read`
			);
		}
		return report;
	}

	/**
	 * A page of the assignees of the tasks that may be due a reminder: due within the longest threshold, open, of an
	 * active employee of the task's own tenant and organization, and not reminded of that due date yet. Ordered by due
	 * date, then task, then employee, so the next page starts after the last row of this one.
	 */
	private async assigneesOfTasksDueSoon(
		after: ITaskDueReminderRow | null,
		limit: number,
		now: Date,
		until: ITaskDueReminderRow | null = null
	): Promise<ITaskDueReminderRow[]> {
		const query = this.dataSource
			.getRepository(Task)
			.createQueryBuilder('task')
			.innerJoin('task.members', 'employee')
			.leftJoin(User, 'user', 'user.id = employee.userId')
			.leftJoin(TaskStatus, 'taskStatus', 'taskStatus.id = task.taskStatusId')
			.select('task.id', 'taskId')
			.addSelect('task.title', 'taskTitle')
			.addSelect('task.dueDate', 'dueDate')
			.addSelect('task.tenantId', 'tenantId')
			.addSelect('task.organizationId', 'organizationId')
			.addSelect('employee.id', 'employeeId')
			.addSelect('user.timeZone', 'userTimeZone')
			.where('task.dueDate IS NOT NULL')
			.andWhere('task.dueDate >= :earliestDue', { earliestDue: new Date(now.getTime() - DAY_ONLY_LATEST_DUE_MS) })
			.andWhere('task.dueDate <= :latestDue', {
				latestDue: new Date(now.getTime() + (MAX_TASK_DUE_REMINDER_HOURS + 1) * HOUR_MS)
			})
			.andWhere('task.tenantId IS NOT NULL')
			.andWhere('task.organizationId IS NOT NULL')
			.andWhere('task.deletedAt IS NULL')
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('task.isArchived IS NULL')
						.orWhere('task.isArchived = :notArchived', { notArchived: false })
				)
			)
			.andWhere(
				new Brackets((draft) =>
					draft.where('task.isDraft IS NULL').orWhere('task.isDraft = :notDraft', { notDraft: false })
				)
			)
			.andWhere(
				new Brackets((open) =>
					open.where('task.status IS NULL').orWhere('task.status NOT IN (:...finished)', {
						finished: FINISHED_STATUSES
					})
				)
			)
			.andWhere(
				new Brackets((open) =>
					open.where('taskStatus.isDone IS NULL').orWhere('taskStatus.isDone = :notDone', { notDone: false })
				)
			)
			.andWhere('employee.tenantId = task.tenantId')
			.andWhere('employee.organizationId = task.organizationId')
			.andWhere('employee.deletedAt IS NULL')
			.andWhere('employee.isActive = :active', { active: true })
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('employee.isArchived IS NULL')
						.orWhere('employee.isArchived = :employeeNotArchived', { employeeNotArchived: false })
				)
			)
			.andWhere((qb) => {
				const reminded = qb
					.subQuery()
					.select('1')
					.from(TaskDueReminder, 'reminder')
					.where('reminder.taskId = task.id')
					.andWhere('reminder.employeeId = employee.id')
					.andWhere('reminder.dueDate = task.dueDate')
					.andWhere('reminder.filedAt IS NOT NULL')
					.getQuery();
				return `NOT EXISTS ${reminded}`;
			})
			.orderBy('task.dueDate', 'ASC')
			.addOrderBy('task.id', 'ASC')
			.addOrderBy('employee.id', 'ASC')
			.limit(limit);
		if (after) {
			query.andWhere(
				new Brackets((next) =>
					next
						.where('task.dueDate > :afterDueDate', { afterDueDate: after.dueDate })
						.orWhere('task.dueDate = :afterDueDate AND task.id > :afterTaskId', {
							afterTaskId: after.taskId
						})
						.orWhere(
							'task.dueDate = :afterDueDate AND task.id = :afterTaskId AND employee.id > :afterEmployeeId',
							{
								afterEmployeeId: after.employeeId
							}
						)
				)
			);
		}
		if (until) {
			query.andWhere(
				new Brackets((upTo) =>
					upTo
						.where('task.dueDate < :untilDueDate', { untilDueDate: until.dueDate })
						.orWhere('task.dueDate = :untilDueDate AND task.id < :untilTaskId', {
							untilTaskId: until.taskId
						})
						.orWhere(
							'task.dueDate = :untilDueDate AND task.id = :untilTaskId AND employee.id <= :untilEmployeeId',
							{ untilEmployeeId: until.employeeId }
						)
				)
			);
		}
		return query.getRawMany<ITaskDueReminderRow>();
	}

	/**
	 * Files the reminders a page of assignments is due, and the ones a stopped process left unfiled. Each one is judged at
	 * the moment the clock gives when its turn comes (see {@link sweep}).
	 */
	private async remindPage(
		page: ITaskDueReminderRow[],
		clock: () => Date,
		report: ITaskDueReminderSweepReport
	): Promise<void> {
		const preferences = await this.preferencesOf(page);
		const claims = await this.claimsOf(page);

		for (const row of page) {
			const now = clock();
			const ofEmployee = preferences.get(this.employeeKeyOf(row));
			const hours = taskDueReminderHoursOf(ofEmployee);
			if (hours === null) {
				continue;
			}
			const timeZone = notificationPreferencesOf(ofEmployee).dnd?.timeZone || row.userTimeZone || null;
			const dueMoment = taskDueMomentOf(row.dueDate, timeZone);
			if (!isTaskDueReminderDue(dueMoment, hours, now.getTime())) {
				continue;
			}
			const own = claims.get(this.claimKeyOf(row));
			try {
				if (!own) {
					const claim = await this.claim(row, now);
					if (claim) {
						await this.file(row, dueMoment, timeZone, claim, now, report, false);
					}
				} else if (
					!own.filedAt &&
					now.getTime() - instantOf(own.claimedAt) >= TASK_DUE_REMINDER_STALE_CLAIM_MS
				) {
					// Claimed by a process that stopped before it filed the notification: taken over, and filed under the
					// claim's own id
					if (await this.takeOver(own, now)) {
						await this.file(row, dueMoment, timeZone, own, now, report, true);
					}
				}
			} catch (error) {
				report.failed += 1;
				this.logger.warn(
					`The due reminder of task ${row.taskId} for employee ${row.employeeId} was not filed: ${(error as Error)?.message ?? error}`
				);
			}
		}
	}

	/**
	 * Files a claimed reminder under the id its claim chose, then records it as filed. A claim taken over looks for a
	 * notification of that id first: the process that stopped may have written it. A notification that could not be
	 * filed gives its claim back, unless it was written after all, or the claim was taken over: that one stays for a
	 * later takeover.
	 */
	private async file(
		row: ITaskDueReminderRow,
		dueMoment: number,
		timeZone: string | null,
		claim: ITaskDueReminderClaim,
		now: Date,
		report: ITaskDueReminderSweepReport,
		takenOver: boolean
	): Promise<void> {
		if (takenOver && (await this.isFiled(claim.employeeNotificationId, row.tenantId))) {
			await this.recordFiled(claim, now);
			return;
		}
		const { title, message } = taskDueReminderNotice(
			row.taskTitle,
			row.dueDate,
			dueMoment,
			now.getTime(),
			timeZone
		);
		const input: IEmployeeNotificationCreateInput & { id: ID } = {
			id: claim.employeeNotificationId,
			title,
			message,
			type: EmployeeNotificationTypeEnum.TASK_DUE_REMINDER,
			entity: BaseEntityEnum.Task,
			entityId: row.taskId,
			receiverEmployeeId: row.employeeId,
			organizationId: row.organizationId,
			tenantId: row.tenantId
		};
		try {
			await runInTimerReminderContext(
				{ tenantId: row.tenantId, organizationId: row.organizationId },
				() => this.notifications.create(input),
				'Task due reminder'
			);
		} catch (error) {
			if (!(await this.isFiled(claim.employeeNotificationId, row.tenantId))) {
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
	private async claim(row: ITaskDueReminderRow, now: Date): Promise<ITaskDueReminderClaim | null> {
		const claimedAt = claimTimeOf(now);
		const claim: ITaskDueReminderClaim = {
			id: randomUUID(),
			employeeNotificationId: randomUUID(),
			claimedAt
		};
		try {
			await this.dataSource.getRepository(TaskDueReminder).insert({
				id: claim.id,
				tenantId: row.tenantId,
				organizationId: row.organizationId,
				taskId: row.taskId,
				employeeId: row.employeeId,
				dueDate: new Date(instantOf(row.dueDate)),
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
	 * Takes over a claim left unfiled past TASK_DUE_REMINDER_STALE_CLAIM_MS: true for the one process whose update wrote
	 * its own time, which the claim then holds as this process's token; false when another took it over first or it
	 * was filed meanwhile.
	 */
	private async takeOver(claim: ITaskDueReminderClaim, now: Date): Promise<boolean> {
		const claimedAt = claimTimeOf(now);
		const result = await this.dataSource.getRepository(TaskDueReminder).update(
			{
				id: claim.id,
				filedAt: IsNull(),
				claimedAt: LessThanOrEqual(new Date(now.getTime() - TASK_DUE_REMINDER_STALE_CLAIM_MS))
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
	private async recordFiled(claim: ITaskDueReminderClaim, now: Date): Promise<void> {
		try {
			await this.dataSource.getRepository(TaskDueReminder).update({ id: claim.id }, { filedAt: now });
		} catch (error) {
			this.logger.warn(
				`The task due reminder claim ${claim.id} was not recorded as filed: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/**
	 * Gives back a claim this process inserted, so the next sweep files the reminder: only while it still holds the time
	 * this process wrote (a filing that outlasted the stale delay may have seen it taken over meanwhile).
	 */
	private async release(claim: ITaskDueReminderClaim): Promise<void> {
		const claimedAt = claim.claimedAt instanceof Date ? claim.claimedAt : new Date(instantOf(claim.claimedAt));
		try {
			await this.dataSource.getRepository(TaskDueReminder).delete({ id: claim.id, claimedAt, filedAt: IsNull() });
		} catch (error) {
			this.logger.warn(
				`The task due reminder claim ${claim.id} was not given back: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/** The `preferences` of the employees' notification settings, read in each employee's own tenant. */
	private async preferencesOf(page: ITaskDueReminderRow[]): Promise<Map<string, unknown>> {
		const employeeIds = [...new Set(page.map((row) => String(row.employeeId)))];
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

	/** The claims of the page's assignments, by task, employee and due date. */
	private async claimsOf(page: ITaskDueReminderRow[]): Promise<Map<string, ITaskDueReminderClaim>> {
		const rows = await this.dataSource.getRepository(TaskDueReminder).find({
			select: {
				id: true,
				taskId: true,
				employeeId: true,
				dueDate: true,
				employeeNotificationId: true,
				claimedAt: true,
				filedAt: true
			},
			where: { taskId: In([...new Set(page.map((row) => String(row.taskId)))]) }
		});
		const claims = new Map<string, ITaskDueReminderClaim>();
		for (const row of rows) {
			claims.set(this.claimKeyOf(row), {
				id: row.id as ID,
				employeeNotificationId: row.employeeNotificationId,
				claimedAt: row.claimedAt,
				filedAt: row.filedAt ?? null
			});
		}
		return claims;
	}

	private employeeKeyOf(row: { employeeId?: ID | null; tenantId?: ID | null }): string {
		return `${row.tenantId}:${row.employeeId}`;
	}

	/** A claim's key: its task, its employee and the instant of its due date. */
	private claimKeyOf(row: { taskId: ID; employeeId: ID; dueDate: Date | string }): string {
		return `${row.taskId}:${row.employeeId}:${instantOf(row.dueDate)}`;
	}
}
