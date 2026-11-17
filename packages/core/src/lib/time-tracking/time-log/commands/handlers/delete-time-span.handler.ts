import { Logger, Optional } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager, FindOptionsSelect, In, IsNull } from 'typeorm';
import { omit, pick } from 'underscore';
import { ID, ITimeLog, ITimeSlot, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { moment } from '../../../../core/moment-extend';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { Timesheet } from '../../../timesheet/timesheet.entity';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeLog } from './../../time-log.entity';
import { createdChange, deletedChange, updatedChange } from '../../time-log-history';
import {
	historySubject,
	locksRowsForChange,
	recordTimeLogHistory,
	TimeLogHistoryOptions,
	TimeLogHistoryRecord
} from '../../time-log-history.writer';
import { isTimeLogUnchangedSince } from '../../time-log-precondition';
import { TimeLogSplitBusyError, withTimeLogSplitLock } from '../../time-log-split-lock';
import { DeleteTimeSpanCommand, TimeLogSplitOptions, TimeLogSplitPartChanges } from '../delete-time-span.command';
import { FindTimeLogRatesCommand } from '../find-time-log-rates.command';
import { TimeLogUpdateCommand, TimeLogUpdateOptions } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { generateTimeSlots } from './../../../time-slot/utils';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

/** The rates a time log stores (see time-log-rates.ts), which the second part of a split keeps. */
const STORED_RATE_FIELDS: Array<keyof TimeLog> = [
	'billRateValue',
	'billRateCurrency',
	'payRateValue',
	'payRateCurrency',
	'projectBillRateValue',
	'projectMemberBillRateValue',
	'projectBillRateCurrency',
	'projectMemberBillRateCurrency',
	'ratesStored'
];

/** The read of those rates, by name. */
const STORED_RATE_SELECT: FindOptionsSelect<TimeLog> = Object.fromEntries([
	['id', true],
	...STORED_RATE_FIELDS.map((field) => [field, true])
]);

/**
 * The changes a split's second part names, without the fields left undefined: those keep the log's value (a field
 * spread as undefined would be saved as empty). A field named `null` clears it.
 *
 * @param changes - What the second part changes, if anything.
 */
function definedChanges(changes: TimeLogSplitPartChanges | undefined): TimeLogSplitPartChanges {
	const entries = Object.entries(changes ?? {}).filter(([, value]) => value !== undefined);
	return Object.fromEntries(entries) as TimeLogSplitPartChanges;
}

/**
 * Raised under the log's lock, in the transaction of a split's cut, when what the split route checked no longer holds:
 * the log was written since the route read it (an invoice line billed it, an edit changed it), or its timesheet was
 * approved or billed. The cut writes nothing, the second part is taken back, and the split answers that the log changed.
 */
class TimeLogChangedSinceSplitCheckError extends Error {
	constructor(timeLogId: ID, what: string) {
		super(`Time log ${timeLogId} changed since its split was checked: ${what}`);
		this.name = 'TimeLogChangedSinceSplitCheckError';
	}
}

/**
 * The `updatedAt` the split route read the log at, as an instant: what the split compares the stored log with. Null
 * when the log it was given carries none (the route's read always does).
 *
 * @param checked - The time log as the route read it.
 */
function checkedVersionOf(checked: ITimeLog): Date | null {
	if (checked?.updatedAt === undefined || checked?.updatedAt === null) {
		return null;
	}
	const version = new Date(checked.updatedAt);
	if (Number.isNaN(version.getTime())) {
		return null;
	}
	return version;
}

/**
 * The check a split's cut makes in its own transaction, under the log's lock, before it writes (see
 * `TimeLogUpdateOptions.assertBeforeWrite`), against the log as the split route read it at `version`:
 * - the log is still at that version: every write of a log moves its `updatedAt`, an invoice line that bills it
 *   included (ever-co/ever-teams#5382), and that write locks the same row, so a billing either landed before this read
 *   and is seen, or waits until the split is whole;
 * - its timesheet is neither approved nor billed: read under a shared lock, which the approval's own locking read waits
 *   for, so an approval that landed before is seen, and one that comes after waits until the split is whole. The read
 *   never waits for that row (`SKIP LOCKED`): the cut already holds the log's lock, and a move of a task's time to
 *   another project locks the timesheets before the logs (`TaskService`), so a wait here could close a lock cycle with
 *   it. A timesheet another transaction holds for a change (an approval in flight) refuses the cut instead.
 *
 * @param version - The `updatedAt` the route read the log at.
 * @returns The check.
 * @throws TimeLogChangedSinceSplitCheckError when either no longer holds, or the timesheet is being changed.
 */
function splitStillAsChecked(version: Date): TimeLogUpdateOptions['assertBeforeWrite'] {
	return async (manager: EntityManager, current: ITimeLog): Promise<void> => {
		if (!isTimeLogUnchangedSince(current.updatedAt, version)) {
			throw new TimeLogChangedSinceSplitCheckError(current.id, 'it was written since');
		}
		if (!current.timesheetId) {
			return;
		}
		const locksRows = locksRowsForChange();
		const timesheet = await manager.findOne(Timesheet, {
			where: { id: current.timesheetId, tenantId: current.tenantId },
			select: { id: true, status: true, isBilled: true },
			loadEagerRelations: false,
			...(locksRows ? { lock: { mode: 'pessimistic_read' as const, onLocked: 'skip_locked' as const } } : {})
		});
		// The log's key keeps its timesheet while the log is locked: a row the read skipped is held for a change
		if (locksRows && !timesheet) {
			throw new TimeLogChangedSinceSplitCheckError(current.id, 'its timesheet is being changed');
		}
		if (timesheet?.status === TimesheetStatus.APPROVED) {
			throw new TimeLogChangedSinceSplitCheckError(current.id, 'its timesheet was approved');
		}
		if (timesheet?.isBilled === true) {
			throw new TimeLogChangedSinceSplitCheckError(current.id, 'its timesheet was billed');
		}
	};
}

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler implements ICommandHandler<DeleteTimeSpanCommand> {
	private readonly logger = new Logger(DeleteTimeSpanHandler.name);

	/**
	 * The cleanups running in this process, by time log: each waits for the one before it to settle, then reads the
	 * log afresh. Two requests over the same log (an entry sent twice, a stop during a manual edit) otherwise both read
	 * it before either wrote, and both split it. The API pods do not share this order; nothing here locks a log across
	 * them, as nothing locks the timer start and stop either. The split route's splits alone also take the database's
	 * lock on their log (see `withTimeLogSplitLock`), so they run one after the other on every pod.
	 */
	private readonly cleanups = new Map<ID, Promise<unknown>>();

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly _commandBus: CommandBus,
		// Records a split's second part in its history, with the part itself; a handler built without it writes as before.
		@Optional() private readonly dataSource?: DataSource
	) {}

	/**
	 * Execute delete time span logic, once the cleanup of the same log before it in this process has settled.
	 *
	 * @param command - The command containing newTime, timeLog, and timeSlot
	 * @returns Promise<boolean>
	 */
	public async execute(command: DeleteTimeSpanCommand): Promise<boolean> {
		const { id } = command.timeLog;
		const previous = this.cleanups.get(id) ?? Promise.resolve();
		const run = previous.then(() => this.cleanUpInTurn(command));
		const settled = run.catch(() => undefined);
		this.cleanups.set(id, settled);
		try {
			return await run;
		} finally {
			if (this.cleanups.get(id) === settled) {
				this.cleanups.delete(id);
			}
		}
	}

	/**
	 * Runs the cleanup, once the split route's split holds the database's lock on its log: a split of the same log on
	 * another API process runs before or after it, never beside it. A split still waiting once that other one ran
	 * for the whole wait writes nothing, and answers that the log was not split, as a log that changed.
	 *
	 * @param command - The command containing newTime, timeLog, and timeSlot
	 * @returns Whether the log was cut, split or deleted.
	 */
	private async cleanUpInTurn(command: DeleteTimeSpanCommand): Promise<boolean> {
		if (!command.split) {
			return await this.cleanUp(command);
		}
		try {
			return await withTimeLogSplitLock(this.dataSource, command.timeLog.id, () => this.cleanUp(command));
		} catch (error) {
			if (error instanceof TimeLogSplitBusyError) {
				this.logger.warn(`${error.message}: time log ${command.timeLog.id} left whole`);
				return false;
			}
			throw error;
		}
	}

	/**
	 * Removes the new range from one time log, as the log is stored when this runs.
	 *
	 * @param command - The command containing newTime, timeLog, and timeSlot
	 * @returns Whether the log was cut, split or deleted.
	 */
	private async cleanUp(command: DeleteTimeSpanCommand): Promise<boolean> {
		const { newTime, timeLog, timeSlot, forceDelete, split } = command;
		const { id } = timeLog;
		const { start, end } = newTime;

		// Retrieve the time log with the specified ID
		const log = await this.typeOrmTimeLogRepository.findOne({
			where: { id },
			relations: { timeSlots: true }
		});

		// Deleting several time slots sends one command per slot and log: once one of them has deleted the log (its
		// last slot, or a span covering it), the next ones find nothing left to trim.
		if (!log) {
			return false;
		}

		// A running log is never cut, split or deleted: its timer still records into it, and the range would take its
		// slots (screenshots, activity) with it. Manual time, offline uploads and the timer stop's own conflict cleanup
		// all come through here, so each of them leaves it whole, as the time-slot delete already does.
		if (log.isRunning) {
			this.debug(() => `Time log ${log.id} is running: left whole`);
			return false;
		}

		// A split asked for at one moment, of any log, manual time without slots included
		if (split) {
			return await this.splitAtMoment(log, timeLog, start, split, forceDelete);
		}

		// The TypeORM conflict lookup lists only logs holding time slots: time saved over a log holding none, which
		// the MikroORM lookup lists too, leaves it as it is.
		const savesTimeOverLog = !timeSlot;
		const holdsNoTimeSlot = isEmpty(log.timeSlots);
		if (savesTimeOverLog && holdsNoTimeSlot) {
			return false;
		}

		const { startedAt, stoppedAt } = log;

		const newTimeRange = moment.range(start, end); // Calculate the new time rang
		const dbTimeRange = moment.range(startedAt, stoppedAt); // Calculate the database time range

		// Nothing of the log is left in the new range: an earlier command already cut it back to the range's edge, or it
		// only touches the range. It is left as it is; the cut below is decided from the log as it is stored now, never
		// from the copy the command carries. Only the slot the time-slot delete names goes.
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			this.debug(() => `Not Overlapping ${JSON.stringify({ newTimeRange, dbTimeRange })}`);
			if (!timeSlot) {
				return false;
			}
			await this.deleteTimeSlotOutsideLog(log, timeSlot, forceDelete);
			return true;
		}

		if (moment(startedAt).isBetween(moment(start), moment(end), null, '[]')) {
			if (moment(stoppedAt).isBetween(moment(start), moment(end), null, '[]')) {
				/*
				 * Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  		|--------------------------------------|
				 */
				// Overlap entire time: delete time log
				this.debug(() => 'Delete time log because overlap entire time.');
				await this.deleteTimeLog(log, forceDelete);
			} else {
				/*
				 * Update start time
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------	|
				 */
				// Partial overlap: update start time or delete
				this.debug(() => 'Partial overlap: update started time or delete');
				await this.updateStartTimeOrDelete(log, end, stoppedAt, forceDelete);
			}
		} else {
			if (moment(stoppedAt).isBetween(moment(start), moment(end), null, '[]')) {
				/*
				 * Update stopped time
				 * New Start time							New Stop time
				 * |----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------|
				 */
				this.debug(() => 'Partial overlap: update stopped time or delete');
				await this.updateStopTimeOrDelete(log, start, startedAt, forceDelete);
			} else {
				/*
				 * Split database time in two entries.
				 * New Start time (start)						New Stop time (end)
				 * |---------------------------------------------------------------|
				 * 		DB Start Time (startedAt)	DB Stop Time (stoppedAt)
				 *  		|--------------------------------------------------|
				 */
				this.debug(() => 'Split database time in two entries.');
				await this.splitAround(log, start, end, forceDelete);
			}
		}

		return true;
	}

	/**
	 * Updates the start time or deletes the time log if remaining duration is 0.
	 *
	 * The update releases the slots of the part it drops, which is the part inside the new range, and only those: a slot
	 * only this log holds goes, one another log shares stays with that log. The slots after the new range stay (the
	 * command's own slot used to be deleted here as well, whatever its time).
	 *
	 * A failure is logged and raised, so that the caller does not record the new range over a log it could not cut. When
	 * the update had already written the new start, the release is finished first (see `finishFailedCut`).
	 *
	 * @param log - The time log to update or delete.
	 * @param end - The end of the new range, the log's new start.
	 * @param stoppedAt - The current stopped time of the log.
	 * @param forceDelete - Whether to hard delete what goes (default: false).
	 * @throws The error of the update or of the delete.
	 */
	private async updateStartTimeOrDelete(
		log: ITimeLog,
		end: Date,
		stoppedAt: Date,
		forceDelete: boolean = false
	): Promise<void> {
		const stoppedAtMoment = moment(stoppedAt); // Get the stopped at moment
		const endMoment = moment(end); // Get the end moment
		const remainingDuration = stoppedAtMoment.diff(endMoment, 'seconds'); // Calculate the remaining duration

		// If there is remaining duration
		if (remainingDuration > 0) {
			// Update the start time if there is remaining duration
			try {
				this.debug(() => `update startedAt time to ${end}`);
				// Update the started at time, releasing the slots before it
				let timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ startedAt: end }, log, true, forceDelete)
				);

				// Check if there are any remaining time slots
				timeLog = await this.typeOrmTimeLogRepository.findOne({
					where: { id: timeLog.id },
					relations: { timeSlots: true }
				});

				// If no remaining time slots, delete the time log
				if (isEmpty(timeLog.timeSlots)) {
					// Delete TimeLog if remaining timeSlots are 0
					await this.deleteTimeLog(timeLog, forceDelete);
				}
			} catch (error) {
				this.logger.warn(`Error while updating startedAt time: ${error?.message ?? error}`, { stack: error?.stack });
				const firstKept = this.firstSlotStart(end, stoppedAt);
				await this.finishFailedCut(
					log,
					(stored) => moment(stored.startedAt).isSame(end),
					(slot) => moment(slot.startedAt).isBefore(firstKept),
					forceDelete
				);
				throw error;
			}
		} else {
			// Delete the time log if remaining duration is 0
			this.debug(() => 'Remaining duration is 0, so we are deleting the time log during update startedAt time');
			await this.deleteTimeLog(log, forceDelete);
		}
	}

	/**
	 * Updates the stoppedAt time for a given time log, or deletes it if the remaining duration is 0.
	 *
	 * As for a new start (see `updateStartTimeOrDelete`), the update releases the slots inside the new range and keeps
	 * the ones before it, and a failure is logged and raised, the release finished first if the new end was written.
	 *
	 * @param log - The time log to update or delete.
	 * @param start - The start of the new range, the log's new end.
	 * @param startedAt - The original start time of the time log.
	 * @param forceDelete - Whether to hard delete what goes (default: false).
	 * @throws The error of the update or of the delete.
	 */
	private async updateStopTimeOrDelete(
		log: ITimeLog,
		start: Date,
		startedAt: Date,
		forceDelete: boolean = false
	): Promise<void> {
		const startedAtMoment = moment(startedAt); // Get the started at moment
		const startMoment = moment(start); // Get the start moment
		const remainingDuration = startMoment.diff(startedAtMoment, 'seconds'); // Calculate the remaining duration

		// If there is remaining duration
		if (remainingDuration > 0) {
			// Update the stoppedAt time if there is remaining duration
			try {
				this.debug(() => `update stoppedAt time to ${start}`);

				// Update the stoppedAt time, releasing the slots after it. With its own start too: an update naming none
				// files the log under the current week's timesheet (as the split does below)
				let timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ startedAt, stoppedAt: start }, log, true, forceDelete)
				);

				// Check if there are any remaining time slots
				timeLog = await this.typeOrmTimeLogRepository.findOne({
					where: { id: timeLog.id },
					relations: { timeSlots: true }
				});

				// If no remaining time slots, delete the time log
				if (isEmpty(timeLog.timeSlots)) {
					await this.deleteTimeLog(timeLog, forceDelete);
				}
			} catch (error) {
				this.logger.warn(`Error while updating stoppedAt time: ${error?.message ?? error}`, { stack: error?.stack });
				await this.finishFailedCut(
					log,
					(stored) => moment(stored.stoppedAt).isSame(start),
					(slot) => !moment(slot.startedAt).isBefore(start),
					forceDelete
				);
				throw error;
			}
		} else {
			this.debug(() => 'Remaining duration is 0, so we are deleting the time log during update stoppedAt time');
			await this.deleteTimeLog(log, forceDelete);
		}
	}

	/**
	 * Splits a log the new range falls inside into the part before the range and the part after it.
	 *
	 * The second part is created first, from the range's end to the log's original end, read before anything is cut.
	 * Only then is the log cut back to the range's start, through the update, which releases the slots it no longer
	 * covers: those inside the range go, those the second part now holds stay with it. (The log used to be cut first and
	 * the second part built from the cut log, so that part ended before it started and was never created.)
	 *
	 * The two writes cannot share a transaction: the cut goes through `TimeLogUpdateCommand`, whose handler writes
	 * through its own repositories. So a failure of either one is raised, which stops the caller before it records the
	 * new range over the log, and leaves no state in between: a second part that cannot be saved has written nothing,
	 * and a failed cut leaves the log as it was or the split finished (see `recoverFailedSplit`).
	 *
	 * @param log - The time log as stored, with its slots.
	 * @param start - The start of the new range, the end of the first part.
	 * @param end - The end of the new range, the start of the second part.
	 * @param forceDelete - Whether to hard delete what goes (default: false).
	 * @param split - Given by the split route: what the second part changes, and the history to record.
	 * @param assertBeforeCut - Given by the split route: what the cut checks under the log's lock, in its own
	 * transaction, before it writes (see `splitStillAsChecked`). A cut it refuses wrote nothing: only the second part is
	 * taken back, and its error is raised.
	 * @throws The error of the write that failed.
	 */
	private async splitAround(
		log: TimeLog,
		start: Date,
		end: Date,
		forceDelete = false,
		split?: TimeLogSplitOptions,
		assertBeforeCut?: TimeLogUpdateOptions['assertBeforeWrite']
	): Promise<void> {
		await this.assertNoSecondPartLeft(log);
		const secondPart = await this.createSecondPart(log, end, log.stoppedAt, split);

		let options: TimeLogUpdateOptions = {};
		if (assertBeforeCut) {
			options = { assertBeforeWrite: assertBeforeCut };
		}
		try {
			// With its own start too: an update naming none files the log under the current week's timesheet
			await this._commandBus.execute(
				new TimeLogUpdateCommand(
					{ startedAt: log.startedAt, stoppedAt: start },
					log,
					true,
					forceDelete,
					split?.history,
					false,
					options
				)
			);
		} catch (error) {
			if (error instanceof TimeLogChangedSinceSplitCheckError) {
				this.logger.warn(`${error.message}: the split of time log ${log.id} is taken back`);
				try {
					await this.takeBackSecondPart(log, secondPart, split?.history);
				} catch (takeBackError) {
					// As for a failed recovery: the part left behind blocks the next split of the log until it is deleted
					this.logger.error(
						`Error while taking back the second part ${secondPart.id} of time log ${log.id}: ${takeBackError?.message ?? takeBackError}`,
						takeBackError?.stack
					);
				}
				throw error;
			}
			this.logger.error(`Error while cutting back time log ${log.id}: ${error?.message ?? error}`, error?.stack);
			try {
				await this.recoverFailedSplit(log, start, secondPart, forceDelete, split?.history);
			} catch (recoveryError) {
				// The part left behind still names this log (`splitFromTimeLogId`): the next split of it is refused
				// until one of the two is deleted (see `assertNoSecondPartLeft`).
				this.logger.error(
					`Error while recovering the split of time log ${log.id} (second part ${secondPart.id}): ${recoveryError?.message ?? recoveryError}`,
					recoveryError?.stack
				);
			}
			throw error;
		}
	}

	/**
	 * Refuses to split a log while a second part an earlier split of it left behind still counts the same time: a live
	 * log cut from it (`splitFromTimeLogId`), inside it and ending where it ends. That is what a split whose cut and
	 * undo both failed leaves. Splitting again would save one more copy of that time; the error stops the caller
	 * instead, as a failed split does. The link is stored, so this holds on every API process and after a restart.
	 * Once that part is deleted, or either log has changed, the log splits as any other; the part of a split that went
	 * through starts after the log's new end, and never stops one.
	 *
	 * Only the parts cut from this very log are looked for: another log ending where this one ends (older overlapping
	 * data has them) is not a part of it, and never stops a split.
	 *
	 * @param log - The time log as stored.
	 * @throws While a second part left behind still duplicates the log's time.
	 */
	private async assertNoSecondPartLeft(log: TimeLog): Promise<void> {
		const parts = await this.typeOrmTimeLogRepository.find({
			where: { splitFromTimeLogId: log.id, tenantId: log.tenantId }
		});
		const left = parts.find(
			(part) =>
				moment(part.stoppedAt).isSame(log.stoppedAt) &&
				moment(part.startedAt).isAfter(log.startedAt) &&
				moment(part.startedAt).isBefore(log.stoppedAt)
		);
		if (!left) {
			return;
		}
		throw new Error(
			`Time log ${log.id} still has the second part (time log ${left.id}) of a split that could not be undone; delete one of them first`
		);
	}

	/**
	 * Creates the part of a split log after the new range: the log's fields over `end`–`stoppedAt`, holding the log's
	 * slots from the ten-minute slot of `end` on, and naming the log it was cut from (`splitFromTimeLogId`, see
	 * `assertNoSecondPartLeft`). One save, so a failure writes neither the log, nor that link, nor its join rows.
	 *
	 * A split asked for by the route may give that part another task, project, notes or billable state; on another
	 * project it takes that project's client rates, as an edit of the project does. With the route's history, the part
	 * and its history row are written in one transaction.
	 *
	 * @param log - The time log as stored, with its slots.
	 * @param end - The end of the new range, the second part's start.
	 * @param stoppedAt - The log's original end, the second part's end.
	 * @param split - Given by the split route: what the second part changes, and the history to record.
	 * @returns The second part, with the slots it holds.
	 */
	private async createSecondPart(
		log: TimeLog,
		end: Date,
		stoppedAt: Date,
		split?: TimeLogSplitOptions
	): Promise<TimeLog> {
		const from = this.firstSlotStart(end, stoppedAt);
		const timeSlots = (log.timeSlots ?? []).filter((slot) => !moment(slot.startedAt).isBefore(from));

		// The same time, priced as the log was: the rates it stores, read by name since a generic read leaves the
		// pay rate and the client rates out (see time-log-rates.ts).
		const storedRates = await this.typeOrmTimeLogRepository.findOne({
			where: { id: log.id },
			select: STORED_RATE_SELECT
		});

		// The same kind of work too: the tags the log is filed under (ever-co/ever-gauzy#12029), which its read leaves out
		// With the soft deleted ones: the part keeps every link the log has, so a tag restored later is on both parts
		const tagged = await this.typeOrmTimeLogRepository.findOne({
			where: { id: log.id },
			relations: { tags: true },
			select: { id: true, tags: { id: true } },
			withDeleted: true
		});

		const changes = definedChanges(split?.secondPart);
		const projectRates = await this.clientRatesOfAnotherProject(log, changes);

		const secondPart = new TimeLog({
			...omit(log, ['id', 'createdAt', 'updatedAt', 'timeSlots', 'duration', 'isEdited', 'tags']),
			...pick(storedRates ?? {}, STORED_RATE_FIELDS),
			...changes,
			...projectRates,
			startedAt: end,
			stoppedAt,
			splitFromTimeLogId: log.id,
			timeSlots,
			tags: tagged?.tags ?? []
		});

		const recordsHistory = Boolean(split?.history) && Boolean(this.dataSource);
		if (!recordsHistory) {
			return await this.typeOrmTimeLogRepository.save(secondPart);
		}
		return await this.dataSource.transaction(async (manager) => {
			const saved = await manager.save(secondPart);
			const record = {
				subject: historySubject(saved),
				change: createdChange(saved),
				reason: split.history.reason
			};
			await recordTimeLogHistory(manager, [record]);
			return saved;
		});
	}

	/**
	 * The client rates of the project a split's second part moves to, as `TimeLogUpdateHandler` gives them to a log an
	 * edit moves to another project; none when the part stays on the log's project.
	 *
	 * @param log - The time log as stored.
	 * @param changes - What the second part changes.
	 */
	private async clientRatesOfAnotherProject(
		log: TimeLog,
		changes: TimeLogSplitPartChanges
	): Promise<Partial<TimeLog>> {
		const namesProject = changes.projectId !== undefined;
		const changesProject = namesProject && String(changes.projectId ?? '') !== String(log.projectId ?? '');
		if (!changesProject) {
			return {};
		}
		const { tenantId, organizationId, employeeId } = log;
		const scope = { tenantId, organizationId, employeeId, projectId: changes.projectId ?? null };
		const rates = await this._commandBus.execute(new FindTimeLogRatesCommand(scope, 'client'));
		return rates ?? {};
	}

	/**
	 * Splits a log at the moment the split route names: the log ends there, and the rest becomes its second part,
	 * through the same split as time saved inside a log (`splitAround`). The route checked the moment against the log it
	 * read; this runs on the log as it is stored once the splits before it settled, and leaves it whole when its range
	 * is no longer the one the route checked (another split, an edit or a delete came first): a split at a moment still
	 * inside it would otherwise cut a part the route never measured, or give the other split's time this one's changes.
	 * It leaves it whole too when it is no longer the time of the member and organization the route checked the caller
	 * against.
	 *
	 * It leaves it whole as well when the log was written in any other way since the route read it: its `updatedAt` is
	 * no longer the one read (an invoice line that bills it moves it, ever-co/ever-teams#5382). The route refuses billed
	 * or approved time, and its check is only as good as the read it made: the cut compares that `updatedAt` again, and
	 * reads the timesheet, under the locks a billing and an approval take, in the transaction it writes in (see
	 * `splitStillAsChecked`). A billing or an approval that lands between the route's check and the cut refuses the cut,
	 * and the split is taken back whole; one that comes after waits for it.
	 *
	 * @param log - The time log as stored, with its slots.
	 * @param checked - The time log as the route read it, when it checked the split.
	 * @param at - The moment to split at.
	 * @param split - What the second part changes, and the history to record.
	 * @param forceDelete - Whether to hard delete what goes (default: false).
	 * @returns Whether the log was split.
	 * @throws The error of the write that failed, as for any split.
	 */
	private async splitAtMoment(
		log: TimeLog,
		checked: ITimeLog,
		at: Date,
		split: TimeLogSplitOptions,
		forceDelete = false
	): Promise<boolean> {
		const keepsStart = moment(log.startedAt).isSame(moment(checked.startedAt));
		const keepsEnd = moment(log.stoppedAt).isSame(moment(checked.stoppedAt));
		const keepsMember = log.employeeId === checked.employeeId;
		const keepsOrganization = log.organizationId === checked.organizationId;
		// The route's read always carries the version; a log given without one is compared on the fields above alone
		const version = checkedVersionOf(checked);
		const keepsVersion = version === null || isTimeLogUnchangedSince(log.updatedAt, version);
		const isAsChecked = keepsStart && keepsEnd && keepsMember && keepsOrganization && keepsVersion;
		if (!isAsChecked) {
			this.debug(() => `Time log ${log.id} changed since the split was checked: left whole`);
			return false;
		}
		const isAfterStart = moment(at).isAfter(moment(log.startedAt));
		const isBeforeEnd = moment(at).isBefore(moment(log.stoppedAt));
		const isInsideLog = isAfterStart && isBeforeEnd;
		if (!isInsideLog) {
			this.debug(() => `Time log ${log.id} no longer holds ${at}: left whole`);
			return false;
		}
		let assertBeforeCut: TimeLogUpdateOptions['assertBeforeWrite'] | undefined;
		if (version !== null) {
			assertBeforeCut = splitStillAsChecked(version);
		}
		try {
			await this.splitAround(log, at, at, forceDelete, split, assertBeforeCut);
		} catch (error) {
			// Refused under the lock: nothing of the log was written, and the second part was taken back
			if (error instanceof TimeLogChangedSinceSplitCheckError) {
				return false;
			}
			throw error;
		}
		return true;
	}

	/**
	 * Leaves a split whose cut failed in one of its two whole states: the log as it was, or the split finished.
	 *
	 * The cut writes the log's new end, then deletes in one go the slots the log alone held, then takes the log off the
	 * slots other logs hold too (see `TimeLogUpdateHandler.applyRelease`). So a log already ending at `start` with one
	 * of its slots gone has had that delete, which cannot be taken back safely (it may be a hard one, and a soft one
	 * took the slots' screenshots and activity with them): the split is finished instead, by taking the log off the
	 * slots it still holds from `start` on with another log, the second part among them, and by recalculating the
	 * totals the cut did not get to (see `finishRelease`). Otherwise nothing of the log was deleted, and the split is
	 * undone: every slot the log held and lost goes back to it, the log gets its range and timesheet back, and the second
	 * part is deleted with its join rows. In that order, so that a failure on the way leaves the time counted twice
	 * rather than lost. A split the route recorded in the history gets its undo recorded there too.
	 *
	 * @param log - The time log as it was read before the split, with its slots.
	 * @param start - The start of the new range, the end the cut gives the log.
	 * @param secondPart - The second part.
	 * @param forceDelete - Whether the cut hard deletes what goes.
	 * @param history - Given by the split route: the split was recorded in the history.
	 */
	private async recoverFailedSplit(
		log: TimeLog,
		start: Date,
		secondPart: TimeLog,
		forceDelete: boolean,
		history?: TimeLogHistoryOptions
	): Promise<void> {
		const slots = await this.slotsAsTheyStand(log);
		const heldBy = (slot: ITimeSlot) => (slot.timeLogs ?? []).map((held) => held.id);
		const stored = await this.typeOrmTimeLogRepository.findOne({ where: { id: log.id } });
		const cut = moment(stored?.stoppedAt).isSame(start);

		if (cut && slots.length < (log.timeSlots ?? []).length) {
			await this.finishRelease(
				log,
				stored,
				slots,
				(slot) => !moment(slot.startedAt).isBefore(start),
				forceDelete
			);
			return;
		}

		const lost = slots.filter((slot) => !heldBy(slot).includes(log.id)).map((slot) => slot.id);
		if (lost.length > 0) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(lost)
				.add(log.id);
		}

		await this.restoreRange(log);
		await this.typeOrmTimeLogRepository.delete({ id: secondPart.id });
		await this.recordUndoneSplit(log, stored, secondPart, history);
	}

	/**
	 * Takes back a split whose cut was refused under the log's lock (see `splitStillAsChecked`): the cut wrote nothing,
	 * so the log is as the write that came first left it, and stays so (its range, its slots, its timesheet). Only the
	 * second part is deleted, with its join rows, and that is recorded in the history when the split recorded its
	 * creation there. A recalculation that ran while the second part stood counted its time as well, so its timesheet
	 * and its employee's worked hours are counted again without it.
	 *
	 * The second part is deleted only while no invoice line bills it and it is still the time of the employee and the
	 * timesheet it was saved for, checked in the statement that deletes it: billing and a move write those columns under
	 * the row's lock, so a part billed meanwhile is never deleted from under its invoice line, and a part moved meanwhile
	 * never leaves its new owner's totals counting time it no longer holds. It is kept then, as a failed undo leaves it,
	 * and blocks the next split of the log until one of the two is deleted (see `assertNoSecondPartLeft`).
	 *
	 * Once the part is deleted, the history and each total are written apart: one that fails is logged, and never
	 * stops the others.
	 *
	 * @param log - The time log as it was read before the split.
	 * @param secondPart - The second part, as it was saved.
	 * @param history - Given by the split route: the split was recorded in the history.
	 */
	private async takeBackSecondPart(
		log: TimeLog,
		secondPart: TimeLog,
		history: TimeLogHistoryOptions | undefined
	): Promise<void> {
		const taken = await this.typeOrmTimeLogRepository.delete({
			id: secondPart.id,
			invoiceItemId: IsNull(),
			employeeId: secondPart.employeeId,
			timesheetId: secondPart.timesheetId ?? IsNull()
		});
		if (taken?.affected === 0) {
			this.logger.error(
				`The second part ${secondPart.id} of time log ${log.id} was billed or moved before its split was taken back: it is kept`
			);
			return;
		}
		const followUps: Array<[string, () => Promise<unknown>]> = [
			['record the undone split', () => this.recordUndoneSplit(log, null, secondPart, history)]
		];
		if (secondPart.timesheetId) {
			followUps.push([
				'recalculate the timesheet',
				() => this._commandBus.execute(new TimesheetRecalculateCommand(secondPart.timesheetId))
			]);
		}
		if (secondPart.employeeId) {
			followUps.push([
				"recalculate the employee's worked hours",
				() => this._commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(secondPart.employeeId))
			]);
		}
		for (const [what, followUp] of followUps) {
			try {
				await followUp();
			} catch (error) {
				this.logger.error(
					`Could not ${what} after taking back the second part ${secondPart.id} of time log ${log.id}: ${error?.message ?? error}`,
					error?.stack
				);
			}
		}
	}

	/**
	 * Records in the history what the undo of a split recorded there put back, so the history ends as the logs do: the
	 * second part, saved with its creation, is deleted, and the log takes back the range that a cut, written with its
	 * own history row, had changed (nothing is recorded for the log when the cut never wrote). A split that recorded
	 * nothing records nothing here either.
	 *
	 * @param log - The time log as it was read before the split.
	 * @param stored - The time log as the failed cut left it, if it is still there.
	 * @param secondPart - The second part, now deleted.
	 * @param history - Given by the split route: the split was recorded in the history.
	 */
	private async recordUndoneSplit(
		log: TimeLog,
		stored: TimeLog | null,
		secondPart: TimeLog,
		history: TimeLogHistoryOptions | undefined
	): Promise<void> {
		const recordedSplit = Boolean(history) && Boolean(this.dataSource);
		if (!recordedSplit) {
			return;
		}
		const records: TimeLogHistoryRecord[] = [
			{ subject: historySubject(secondPart), change: deletedChange(secondPart), reason: null }
		];
		if (stored) {
			const restored = { ...stored, startedAt: log.startedAt, stoppedAt: log.stoppedAt };
			const rangeBack = updatedChange(stored, restored);
			if (rangeBack) {
				records.push({ subject: historySubject(restored), change: rangeBack, reason: null });
			}
		}
		await this.dataSource.transaction(async (manager) => recordTimeLogHistory(manager, records));
	}

	/**
	 * After a cut at one end failed: when it had written the log's new start or end, the log is left holding no slot
	 * outside that range. The release is finished (see `finishRelease`): the cut may have failed on the delete of the
	 * slots only the log held there, which goes in one go, so they may all still be there. When the release cannot be
	 * finished and the log still holds every slot it held before the cut, nothing of it was deleted, and the log gets
	 * its range and timesheet back instead. When the cut had not written the new start or end, nothing was written.
	 * A failure here is logged, and the cut's own error stays the one raised.
	 *
	 * @param log - The time log as it was read before the cut, with its slots.
	 * @param isCut - Whether the log as stored has its new start or end.
	 * @param outside - Whether a slot lies outside the log's new range.
	 * @param forceDelete - Whether the cut hard deletes what goes.
	 */
	private async finishFailedCut(
		log: ITimeLog,
		isCut: (stored: ITimeLog) => boolean,
		outside: (slot: ITimeSlot) => boolean,
		forceDelete: boolean
	): Promise<void> {
		try {
			const stored = await this.typeOrmTimeLogRepository.findOne({ where: { id: log.id } });
			if (!stored || !isCut(stored)) {
				return;
			}
			try {
				await this.finishRelease(log, stored, await this.slotsAsTheyStand(log), outside, forceDelete);
			} catch (releaseError) {
				if (!(await this.holdsEverySlot(log))) {
					throw releaseError;
				}
				this.logger.warn(
					`Time log ${log.id} gets its range back, as its slots outside the new one could not be deleted: ${releaseError?.message ?? releaseError}`
				);
				await this.restoreRange(log);
			}
		} catch (finishError) {
			this.logger.error(
				`Error while finishing the failed cut of time log ${log.id}: ${finishError?.message ?? finishError}`,
				finishError?.stack
			);
		}
	}

	/**
	 * Whether the log still holds every slot it held when it was read: none of them was deleted or taken off it.
	 *
	 * @param log - The time log as it was read, with its slots.
	 */
	private async holdsEverySlot(log: ITimeLog): Promise<boolean> {
		const slots = await this.slotsAsTheyStand(log);
		const holdsIt = (slot: ITimeSlot) => (slot.timeLogs ?? []).some((held) => held.id === log.id);
		return slots.length === (log.timeSlots ?? []).length && slots.every(holdsIt);
	}

	/**
	 * Gives a log back the range and the timesheet it had when it was read, which a cut had changed.
	 *
	 * @param log - The time log as it was read before the cut.
	 */
	private async restoreRange(log: ITimeLog): Promise<void> {
		const { startedAt, stoppedAt, timesheetId } = log;
		await this.typeOrmTimeLogRepository.update(
			{ id: log.id, tenantId: log.tenantId },
			{ startedAt, stoppedAt, timesheetId }
		);
	}

	/**
	 * The slots a log held when it was read, as they now stand, with their logs (a deleted one is not read).
	 *
	 * @param log - The time log as it was read, with its slots.
	 */
	private async slotsAsTheyStand(log: ITimeLog): Promise<ITimeSlot[]> {
		const ids = (log.timeSlots ?? []).map((slot) => slot.id);
		if (ids.length === 0) {
			return [];
		}
		return await this.typeOrmTimeSlotRepository.find({
			where: { id: In(ids) },
			relations: { timeLogs: true }
		});
	}

	/**
	 * The start of the first slot of a range from `start` to `stoppedAt`, as the update computes a log's slots: the slot
	 * holding `start`, taken at its whole minute (the helper keeps the milliseconds of `start`, and a stored slot's start
	 * has none).
	 *
	 * @param start - The start of the range.
	 * @param stoppedAt - The end of the range.
	 */
	private firstSlotStart(start: Date, stoppedAt: Date) {
		const [firstSlot] = generateTimeSlots(start, stoppedAt);
		return moment(firstSlot?.startedAt ?? start).startOf('minute');
	}

	/**
	 * Finishes the release of a cut that wrote the log's new range and then failed, in the cut's own order: the slots
	 * outside that range only the log still holds are deleted, hard or soft as the cut was asked (the cut deletes them
	 * in one go, so they are all still there when that delete failed, and none when it went through), each only while
	 * the log still holds it alone, the log is taken off the slots it still holds there with another log, and the totals
	 * the cut recalculates last are recalculated.
	 *
	 * @param log - The time log as it was read before the cut.
	 * @param stored - The same log as stored after the cut, which may have filed it under another week's timesheet.
	 * @param slots - The slots the log held before the cut, as they now stand, with their logs.
	 * @param outside - Whether a slot lies outside the log's new range.
	 * @param forceDelete - Whether the cut hard deletes what goes.
	 */
	private async finishRelease(
		log: ITimeLog,
		stored: ITimeLog,
		slots: ITimeSlot[],
		outside: (slot: ITimeSlot) => boolean,
		forceDelete: boolean
	): Promise<void> {
		const heldBy = (slot: ITimeSlot) => (slot.timeLogs ?? []).map((held) => held.id);
		const heldOutside = (standing: ITimeSlot[]) =>
			standing.filter(outside).filter((slot) => heldBy(slot).includes(log.id));
		const heldByAnother = (slot: ITimeSlot) => heldBy(slot).some((id) => id !== log.id);

		let standing = slots;
		const own = heldOutside(standing)
			.filter((slot) => !heldByAnother(slot))
			.map((slot) => slot.id);
		if (own.length > 0) {
			// Deleted only while the log still holds each of them alone, as the slot delete reads them (its conditional
			// mode): a slot another log took since they were read here, a timer started in its ten minutes, stays.
			const { organizationId, employeeId, tenantId } = log;
			await this._commandBus.execute(
				new TimeSlotBulkDeleteCommand(
					{ organizationId, employeeId, tenantId, timeLog: log, timeSlotsIds: own },
					forceDelete,
					false
				)
			);
			// What is left of them, with their logs as they now are
			standing = await this.slotsAsTheyStand(log);
		}

		const shared = heldOutside(standing)
			.filter(heldByAnother)
			.map((slot) => slot.id);
		if (shared.length > 0) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(shared)
				.remove(log.id);
		}

		// The timesheet the log was on, which a split's second part keeps, and the one the cut filed it under when that
		// is another week's (the update files the log under the week of the start it names, or of today when it names none)
		const timesheetIds = new Set([log.timesheetId, stored.timesheetId].filter(Boolean));
		for (const timesheetId of timesheetIds) {
			await this._commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
		}
		if (log.employeeId) {
			await this._commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(log.employeeId));
		}
	}

	/**
	 * Deletes the slot the time-slot delete names when its log's time no longer reaches it, which leaves the log as it
	 * is, and recalculates the log's timesheet without the slot. A slot a running log holds too stays with that log,
	 * which the time-slot delete never cuts: this log only lets go of it.
	 *
	 * The logs holding the slot are read again here: the time-slot delete read them before the cleanups queued ahead of
	 * this one ran, and a timer may have started on the slot, or a running log let go of it, since.
	 *
	 * @param log - The log holding the slot, as stored.
	 * @param timeSlot - The slot to delete.
	 * @param forceDelete - Whether to hard delete it (default: false).
	 * @throws The error of the read, of the delete, of the unlink or of the recalculation.
	 */
	private async deleteTimeSlotOutsideLog(log: ITimeLog, timeSlot: ITimeSlot, forceDelete = false): Promise<void> {
		const [current] = await this.typeOrmTimeSlotRepository.find({
			where: { id: timeSlot.id },
			relations: { timeLogs: true }
		});
		if (!current) {
			// Another cleanup deleted it meanwhile: only the log's totals are left to count
			await this._commandBus.execute(new TimesheetRecalculateCommand(log.timesheetId));
			return;
		}
		const runningTimeLogs = (current.timeLogs ?? []).filter((timeLog) => timeLog.isRunning);
		const heldByRunningLog = runningTimeLogs.length > 0;
		if (heldByRunningLog) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(timeSlot.id)
				.remove(log.id);
		} else {
			const { organizationId, employeeId } = log;
			const timeSlotsIds = [timeSlot.id];
			await this._commandBus.execute(
				new TimeSlotBulkDeleteCommand(
					{ organizationId, employeeId, timeLog: log, timeSlotsIds },
					forceDelete,
					true
				)
			);
		}
		await this._commandBus.execute(new TimesheetRecalculateCommand(log.timesheetId));
	}

	/**
	 * Deletes a time log if it overlaps the entire time range. A failure is logged and raised, as for a cut.
	 *
	 * @param timeLog - The log to delete.
	 * @param forceDelete - Whether to hard delete (default: false).
	 * @returns Promise<void> - Resolves when deletion is complete.
	 * @throws The error of the delete.
	 */

	private async deleteTimeLog(timeLog: ITimeLog, forceDelete: boolean = false): Promise<void> {
		try {
			// Execute the TimeLogDeleteCommand to delete the time log
			await this._commandBus.execute(new TimeLogDeleteCommand(timeLog, forceDelete));
		} catch (error) {
			// Log any errors that occur during deletion
			this.logger.warn(
				`Error while deleting the time log overlapping the entire time for ID: ${timeLog.id}: ${error?.message ?? error}`,
				{ stack: error?.stack }
			);
			throw error;
		}
	}

	/**
	 * Diagnostic trace of the overlap handling, at debug level: the message is built only when debug logging
	 * is on (these ran as unconditional console output before).
	 *
	 * @param message - Builds the message to be logged.
	 */
	private debug(message: () => string): void {
		if (Logger.isLevelEnabled('debug')) {
			this.logger.debug(message());
		}
	}
}
