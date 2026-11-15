import { ConflictException, Optional } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager, In, IsNull, Not } from 'typeorm';
import * as moment from 'moment';
import { TimeLogType, TimeLogSourceEnum, ID, ITimeSlot, ITimesheet } from '@gauzy/contracts';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../commands/update-employee-total-worked-hours.command';
import { RequestContext } from '../../../../core/context';
import { TimeLogService } from '../../time-log.service';
import { TimeLog } from '../../time-log.entity';
import { Employee } from '../../../../core/entities/internal';
import { isUniqueViolation } from '../../../../core/errors/unique-violation';
import { TRACKER_SOURCES } from '../../tracker-source';
import { assertTimeLogReferencesOfTenant } from '../../time-log-references';
import { TimeLogCreateCommand, TimeLogCreateOptions } from '../time-log-create.command';
import { FindTimeLogRatesCommand } from '../find-time-log-rates.command';
import { createdChange } from '../../time-log-history';
import {
	historySubject,
	lockedForChange,
	locksRowsForChange,
	recordTimeLogHistory,
	TimeLogHistoryOptions
} from '../../time-log-history.writer';
import { MikroOrmTimeLogRepository } from '../../repository/mikro-orm-time-log.repository';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

/**
 * Whether the time log being created is stored as running: as the input says, or, when it says nothing, a log
 * from the desktop timer — the default `createTimeLogEntity` applies.
 *
 * @param input - The time log about to be created.
 * @returns `true` when the log is written with `isRunning: true`.
 */
export function isRunningTimeLogInput(input: Partial<TimeLog>): boolean {
	return input.isRunning === undefined ? input.source === TimeLogSourceEnum.DESKTOP : !!input.isRunning;
}

/**
 * A running log is written with `stoppedAt = startedAt`, the shape `TimerService.startTimer` gives it (the
 * time-slot heartbeat then moves `stoppedAt` forward while it runs). Other callers — the integration sync
 * (`IntegrationMapSyncTimeLogHandler`, which passes its entity as-is), a desktop-source log that names no end —
 * could store a running log with a null `stoppedAt`, and the timer status and stop / toggle reads never found such
 * a row: the timer read "stopped" while the row ran, and nothing stopped it. The input is given that shape here, at
 * the one place every create goes through. A log that names its `stoppedAt`, or is not running, is left as it is.
 *
 * @param input - The time log about to be created.
 * @returns The input, with `stoppedAt` set to `startedAt` when the log runs and names no end.
 */
export function withRunningLogStoppedAt<T extends Partial<TimeLog>>(input: T): T {
	if (!input || input.stoppedAt || !input.startedAt || !isRunningTimeLogInput(input)) {
		return input;
	}
	return { ...input, stoppedAt: input.startedAt };
}

/** The code of the refusal of a timer start while another run of the employee is still going. */
export const TIMER_STILL_RUNNING = 'TIMER_STILL_RUNNING';

/** The refusal of a timer start while another run of the employee is still going. */
function timerStillRunning(): ConflictException {
	return new ConflictException({
		message:
			'Your previous timer is still running and could not be stopped, so no new one was started. Stop it, then start again.',
		code: TIMER_STILL_RUNNING
	});
}

/**
 * Refuses a timer start's run while another run of the employee is still going: the start's close of the runs going
 * failed to stop one, or a run was written since. Read under the employee's row lock, which every start of the employee
 * takes in the same transaction before writing its run, so two starts check and write one after the other. SQLite takes
 * no row lock and writes without a transaction here: the running-log key refuses a run written between the check and
 * the insert. A tracker's rows are left out: the desktop stores the time it uploads as running by design, and the
 * start's close ends them on its own (`ScheduleTimeLogEntriesCommand`).
 *
 * @param manager - The transaction the run is written in, or the repository's manager on SQLite.
 * @param timeLog - The run about to be written.
 * @throws ConflictException with the code TIMER_STILL_RUNNING.
 */
async function assertNoRunGoing(manager: EntityManager, timeLog: TimeLog): Promise<void> {
	const { employeeId, tenantId } = timeLog;
	await manager.findOne(Employee, { where: { id: employeeId, tenantId }, ...lockedForChange() });
	const going = await manager.count(TimeLog, {
		where: {
			employeeId,
			tenantId,
			isRunning: true,
			deletedAt: IsNull(),
			source: Not(In([...TRACKER_SOURCES]))
		}
	});
	if (going > 0) {
		throw timerStillRunning();
	}
}

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler implements ICommandHandler<TimeLogCreateCommand> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly _commandBus: CommandBus,
		private readonly _timeSlotService: TimeSlotService,
		private readonly _timeLogService: TimeLogService,
		// Records the history of a change a person makes; a handler built without it writes as before.
		@Optional() private readonly dataSource?: DataSource
	) {}

	/**
	 * Handles the execution of the TimeLogCreateCommand
	 *
	 * @param command TimeLogCreateCommand
	 * @returns Promise<TimeLog>
	 */
	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		const input = withRunningLogStoppedAt(command.input);
		const { startedAt, employeeId, organizationId, stoppedAt, timeSlots: inputTimeSlots } = input;

		// Retrieve the tenant ID from the current context or the provided one in the input
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		// The project, task, client and team the log names are rows of its tenant, checked before anything is written
		await assertTimeLogReferencesOfTenant(this.typeOrmTimeLogRepository, input, tenantId);

		// Create timesheet if it doesn't exist
		const timesheet = await this._commandBus.execute(
			new TimesheetFirstOrCreateCommand(startedAt, employeeId, organizationId)
		);

		// The rates of the moment price the log: a later rate change re-prices them as time-log-repricing.ts says (all
		// past time, or from a day, or none when the organization's time logs keep their rates). Never taken from the
		// input: a client names no price for its time.
		const rates = await this._commandBus.execute(
			new FindTimeLogRatesCommand({ tenantId, organizationId, employeeId, projectId: input.projectId ?? null })
		);

		// Create time log entity
		const timeLog = this.createTimeLogEntity(input, tenantId, timesheet);
		Object.assign(timeLog, rates ?? {});

		// A break holds no time slots: a slot is worked time (activity, screenshots), which a break never is, and the
		// totals that read slots leave it out that way
		const isBreak = input.logType === TimeLogType.BREAK;
		const takesBlankSlots = Boolean(stoppedAt) && !isBreak;

		// Generate blank time slots if stoppedAt is provided
		let generatedTimeSlots: ITimeSlot[] = [];
		if (takesBlankSlots) {
			generatedTimeSlots = this.generateBlankTimeSlots(input, tenantId);
		}
		let sentTimeSlots = inputTimeSlots;
		if (isBreak) {
			sentTimeSlots = [];
		}

		// Merge input time slots with generated blank slots
		const mergeTimeSlots = this.mergeTimeSlots(
			generatedTimeSlots,
			sentTimeSlots,
			employeeId,
			organizationId,
			tenantId
		);

		// Bulk create time slots
		timeLog.timeSlots = await this._timeSlotService.bulkCreate(mergeTimeSlots, employeeId, organizationId);

		await this.saveTimeLog(timeLog, command.history, command.options);

		// Recalculate timesheet activity
		await this.recalculateTimesheet(timesheet);

		// Update total worked hours for the employee
		await this.updateEmployeeTotalWorkedHours(employeeId);

		// Return the newly created time log
		return await this._timeLogService.findOneByIdString(timeLog.id);
	}

	/**
	 * Creates a new TimeLog entity based on the provided input
	 *
	 * @param input Partial<TimeLog>
	 * @param tenantId ID
	 * @param timesheet ITimesheet
	 * @returns TimeLog
	 */
	private async saveTimeLog(
		timeLog: TimeLog,
		history: TimeLogHistoryOptions | undefined,
		options?: TimeLogCreateOptions
	): Promise<void> {
		const recordsHistory = Boolean(history) && Boolean(this.dataSource);
		const isOnlyRun = Boolean(options?.isOnlyRun) && Boolean(this.dataSource);
		// A timer start's run is checked under the employee's row lock, in the transaction it is written in, where the
		// database locks rows. SQLite locks none and runs every write on its one connection, where a transaction begun
		// beside another nests into it, and the refusal's rollback would take the other request's writes with it: there
		// the check and the insert run without one, and the running-log key refuses a run written between them.
		const checksInTransaction = isOnlyRun && locksRowsForChange();
		try {
			if (!recordsHistory && !checksInTransaction) {
				if (isOnlyRun) {
					await assertNoRunGoing(this.typeOrmTimeLogRepository.manager, timeLog);
				}
				await this.typeOrmTimeLogRepository.save(timeLog);
				return;
			}
			// Added by a person: the entry and its history row are written together, or neither is. A timer start's
			// run: it is written with the check that no other run is still going, or not at all.
			await this.dataSource.transaction(async (manager) => {
				if (isOnlyRun) {
					await assertNoRunGoing(manager, timeLog);
				}
				await manager.getRepository(TimeLog).save(timeLog);
				if (recordsHistory) {
					await recordTimeLogHistory(manager, [
						{ subject: historySubject(timeLog), change: createdChange(timeLog), reason: history.reason }
					]);
				}
			});
		} catch (error) {
			// The running-log key refused a second run written past the check (ever-co/ever-gauzy#11826)
			const isSecondRun = isOnlyRun && (isUniqueViolation(error) || isUniqueViolation(error?.driverError));
			if (isSecondRun) {
				throw timerStillRunning();
			}
			throw error;
		}
	}

	private createTimeLogEntity(input: Partial<TimeLog>, tenantId: ID, timesheet: ITimesheet): TimeLog {
		const {
			startedAt,
			stoppedAt,
			employeeId,
			organizationId,
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			logType = TimeLogType.MANUAL,
			description = null,
			reason = null,
			isBillable = false,
			source = TimeLogSourceEnum.WEB_TIMER,
			version = null,
			isRunning = source === TimeLogSourceEnum.DESKTOP
		} = input;

		console.log('create new time log with', { input, tenantId, timesheet });

		return new TimeLog({
			startedAt: moment.utc(startedAt).toDate(),
			stoppedAt: stoppedAt ? moment.utc(stoppedAt).toDate() : undefined,
			timesheet,
			organizationId,
			tenantId,
			employeeId,
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			logType,
			description,
			reason,
			isBillable,
			source,
			version,
			isRunning
		});
	}

	/**
	 * Generates blank time slots between startedAt and stoppedAt
	 * @param input Partial<TimeLog>
	 * @param tenantId string
	 * @returns ITimeSlot[]
	 */
	private generateBlankTimeSlots(input: Partial<TimeLog>, tenantId: ID): ITimeSlot[] {
		const { startedAt, stoppedAt, employeeId, organizationId } = input;

		// Generate time slots between startedAt and stoppedAt
		return this._timeSlotService.generateTimeSlots(startedAt, stoppedAt).map((slot) => ({
			...slot,
			employeeId,
			organizationId,
			tenantId,
			keyboard: 0,
			mouse: 0,
			overall: 0
		}));
	}

	/**
	 * Merges input time slots with generated blank slots
	 * @param generatedSlots ITimeSlot[]
	 * @param inputSlots ITimeSlot[]
	 * @param employeeId ID
	 * @param organizationId ID
	 * @param tenantId ID
	 * @returns ITimeSlot[]
	 */
	private mergeTimeSlots(
		generatedSlots: ITimeSlot[],
		inputSlots: ITimeSlot[] = [],
		employeeId: ID,
		organizationId: ID,
		tenantId: ID
	): ITimeSlot[] {
		const standardizedInputSlots = inputSlots.map((slot) => ({
			...slot,
			employeeId,
			organizationId,
			tenantId
		}));

		return generatedSlots.map((blankSlot) => {
			const matchingSlot = standardizedInputSlots.find((slot) =>
				moment(slot.startedAt).isSame(blankSlot.startedAt)
			);
			return matchingSlot ? { ...matchingSlot } : blankSlot;
		});
	}

	/**
	 * Recalculates the timesheet activity
	 * @param timesheet ITimesheet
	 */
	private async recalculateTimesheet(timesheet: ITimesheet): Promise<void> {
		if (timesheet?.id) {
			await this._commandBus.execute(new TimesheetRecalculateCommand(timesheet.id));
		}
	}

	/**
	 * Updates total worked hours for the employee
	 *
	 * @param employeeId ID
	 */
	private async updateEmployeeTotalWorkedHours(employeeId: ID): Promise<void> {
		await this._commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
	}
}
