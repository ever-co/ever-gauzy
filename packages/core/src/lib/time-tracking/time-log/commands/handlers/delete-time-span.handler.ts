import { Logger } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { omit } from 'underscore';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { moment } from '../../../../core/moment-extend';
import { TimeLog } from './../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { generateTimeSlots } from './../../../time-slot/utils';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler implements ICommandHandler<DeleteTimeSpanCommand> {
	private readonly logger = new Logger(DeleteTimeSpanHandler.name);

	/**
	 * The cleanups running in this process, by time log: each waits for the one before it to settle, then reads the
	 * log afresh. Two requests over the same log (an entry sent twice, a stop during a manual edit) otherwise both read
	 * it before either wrote, and both split it. The API pods do not share this order; nothing here locks a log across
	 * them, as nothing locks the timer start and stop either.
	 */
	private readonly cleanups = new Map<ID, Promise<unknown>>();

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly _commandBus: CommandBus
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
		const run = previous.then(() => this.cleanUp(command));
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
	 * Removes the new range from one time log, as the log is stored when this runs.
	 *
	 * @param command - The command containing newTime, timeLog, and timeSlot
	 * @returns Whether the log was cut, split or deleted.
	 */
	private async cleanUp(command: DeleteTimeSpanCommand): Promise<boolean> {
		const { newTime, timeLog, forceDelete } = command;
		const { id } = timeLog;
		const { start, end } = newTime;

		// Retrieve the time log with the specified ID
		const log = await this.typeOrmTimeLogRepository.findOne({
			where: { id },
			relations: { timeSlots: true }
		});

		// Callers send one command per slot of a conflicting log. When the new range covers that log, the
		// command for its first slot deletes the whole log, so the next ones find nothing left to trim.
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

		const { startedAt, stoppedAt } = log;

		const newTimeRange = moment.range(start, end); // Calculate the new time rang
		const dbTimeRange = moment.range(startedAt, stoppedAt); // Calculate the database time range

		// Nothing of the log is left in the new range: the command for an earlier slot of it already cut it back to the
		// range's edge, or it only touches the range. It is left as it is, with every slot it holds; the cut below is
		// decided from the log as it is stored now, never from the copy the command carries.
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			this.debug(() => `Not Overlapping ${JSON.stringify({ newTimeRange, dbTimeRange })}`);
			return false;
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
	 * A failure is logged and raised, so that the caller does not record the new range over a log it could not cut.
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
	 * the ones before it, and a failure is logged and raised.
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

				// Update the stoppedAt time, releasing the slots after it
				let timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ stoppedAt: start }, log, true, forceDelete)
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
	 * @throws The error of the write that failed.
	 */
	private async splitAround(log: TimeLog, start: Date, end: Date, forceDelete: boolean = false): Promise<void> {
		await this.assertNoSecondPartLeft(log);
		const secondPart = await this.createSecondPart(log, end, log.stoppedAt);

		try {
			// With its own start too: an update naming none files the log under the current week's timesheet
			await this._commandBus.execute(
				new TimeLogUpdateCommand({ startedAt: log.startedAt, stoppedAt: start }, log, true, forceDelete)
			);
		} catch (error) {
			this.logger.error(`Error while cutting back time log ${log.id}: ${error?.message ?? error}`, error?.stack);
			try {
				await this.recoverFailedSplit(log, start, secondPart);
			} catch (recoveryError) {
				this.logger.error(
					`Error while recovering the split of time log ${log.id} (second part ${secondPart.id}): ${recoveryError?.message ?? recoveryError}`,
					recoveryError?.stack
				);
			}
			throw error;
		}
	}

	/**
	 * Refuses to split a log that already has a second part: a stopped log of the same employee inside it and ending
	 * where it ends, which only a split leaves behind, when its cut failed and so did the recovery of that cut. Splitting
	 * again would save one more copy of that time; the error stops the caller instead, as a failed split does, until one
	 * of the two logs is deleted.
	 *
	 * @param log - The time log as stored.
	 * @throws When such a second part is found.
	 */
	private async assertNoSecondPartLeft(log: TimeLog): Promise<void> {
		const { id, employeeId, organizationId, tenantId, startedAt, stoppedAt } = log;
		const endingWithIt = await this.typeOrmTimeLogRepository.find({
			where: { employeeId, organizationId, tenantId, stoppedAt }
		});
		const secondPart = endingWithIt.find(
			(other) => other.id !== id && !other.isRunning && moment(other.startedAt).isAfter(startedAt)
		);
		if (secondPart) {
			throw new Error(
				`Time log ${id} already has a second part (time log ${secondPart.id}) from a split that could not be undone; delete one of them first`
			);
		}
	}

	/**
	 * Creates the part of a split log after the new range: the log's fields over `end`–`stoppedAt`, holding the log's
	 * slots from the ten-minute slot of `end` on. One save, so a failure writes neither the log nor its join rows.
	 *
	 * @param log - The time log as stored, with its slots.
	 * @param end - The end of the new range, the second part's start.
	 * @param stoppedAt - The log's original end, the second part's end.
	 * @returns The second part, with the slots it holds.
	 */
	private async createSecondPart(log: TimeLog, end: Date, stoppedAt: Date): Promise<TimeLog> {
		// The slots of the second part, as the update computes a log's slots: the first one is the slot holding `end`,
		// taken at its whole minute (the helper keeps the milliseconds of `end`, and a stored slot's start has none)
		const [firstSlot] = generateTimeSlots(end, stoppedAt);
		const from = moment(firstSlot?.startedAt ?? end).startOf('minute');
		const timeSlots = (log.timeSlots ?? []).filter((slot) => !moment(slot.startedAt).isBefore(from));

		return await this.typeOrmTimeLogRepository.save(
			new TimeLog({
				...omit(log, ['id', 'createdAt', 'updatedAt', 'timeSlots', 'duration', 'isEdited']),
				startedAt: end,
				stoppedAt,
				timeSlots
			})
		);
	}

	/**
	 * Leaves a split whose cut failed in one of its two whole states: the log as it was, or the split finished.
	 *
	 * The cut writes the log's new end, then takes the log off the slots other logs hold, then deletes in one go the
	 * slots it alone held (see `TimeLogUpdateHandler.applyRelease`): that delete is its last write before the totals.
	 * So a log already ending at `start` with one of its slots gone has had every write, and the split is kept as it is
	 * (the restore the alternative would need cannot be done safely: the delete may be a hard one, and a soft one took
	 * the slots' screenshots and activity with them). Otherwise nothing of the log was deleted, and the split is undone:
	 * every slot the log held and lost goes back to it, the log gets its range and timesheet back, and the second part
	 * is deleted with its join rows. In that order, so that a failure on the way leaves the time counted twice rather
	 * than lost.
	 *
	 * @param log - The time log as it was read before the split, with its slots.
	 * @param start - The start of the new range, the end the cut gives the log.
	 * @param secondPart - The second part.
	 */
	private async recoverFailedSplit(log: TimeLog, start: Date, secondPart: TimeLog): Promise<void> {
		// The slots the log held before the split, as they now stand (a deleted one is not read)
		const ids = (log.timeSlots ?? []).map((slot) => slot.id);
		let slots: ITimeSlot[] = [];
		if (ids.length > 0) {
			slots = await this.typeOrmTimeSlotRepository.find({
				where: { id: In(ids) },
				relations: { timeLogs: true }
			});
		}
		const stored = await this.typeOrmTimeLogRepository.findOne({ where: { id: log.id } });
		const cut = moment(stored?.stoppedAt).isSame(start);
		if (cut && slots.length < ids.length) {
			return;
		}

		const lost = slots
			.filter((slot) => !(slot.timeLogs ?? []).some((held) => held.id === log.id))
			.map((slot) => slot.id);
		if (lost.length > 0) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(lost)
				.add(log.id);
		}

		const { startedAt, stoppedAt, timesheetId } = log;
		await this.typeOrmTimeLogRepository.update(
			{ id: log.id, tenantId: log.tenantId },
			{ startedAt, stoppedAt, timesheetId }
		);
		await this.typeOrmTimeLogRepository.delete({ id: secondPart.id });
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
