import { Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import * as moment from 'moment';
import { chain, omit, pluck, uniq } from 'underscore';
import { DateRange, IActivity, ID, IScreenshot, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { Activity, Screenshot, TimeSlot } from './../../../../core/entities/internal';
import { RequestContext } from './../../../../core/context';
import { getDateRangeFormat, MultiORM, MultiORMEnum, getORMType, wrapSerialize } from './../../../../core/utils';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../time-log/commands/update-employee-total-worked-hours.command';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands/timesheet-recalculate.command';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../../repository/mikro-orm-time-slot.repository';

interface IAggregatedTimeSlot {
	duration: number;
	keyboard: number;
	mouse: number;
	overall: number;
	screenshots: IScreenshot[];
	timeLogs: ITimeLog[];
	activities: IActivity[];
}

@CommandHandler(TimeSlotMergeCommand)
export class TimeSlotMergeHandler implements ICommandHandler<TimeSlotMergeCommand> {
	private readonly logger = new Logger(TimeSlotMergeHandler.name);
	protected ormType: MultiORM = getORMType();

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Execute the TimeSlot merge command
	 *
	 * @param command - The TimeSlotMergeCommand to execute
	 */
	public async execute(command: TimeSlotMergeCommand): Promise<ITimeSlot[]> {
		const { organizationId, employeeId, start, end, forceDelete } = command;
		const tenantId = RequestContext.currentTenantId();

		// Round start and end dates to the nearest 10 minutes
		const { start: startedAt, end: stoppedAt } = this.getRoundedDateRange(start, end);

		// Retrieve time slots for the given date range
		const slots = await this.getTimeSlots({
			organizationId,
			employeeId,
			tenantId,
			startedAt,
			stoppedAt
		});
		this.debug(() => `GET Time Slots To Be Merged Length: ${slots.length}`);

		if (isNotEmpty(slots)) {
			const groupedTimeSlots = this.groupTimeSlots(slots); // Group time slots by rounded start time

			// Aggregate data and save new time slots
			return await this.mergeAndSaveTimeSlots(
				groupedTimeSlots, // Group time slots by rounded start time
				tenantId,
				organizationId,
				employeeId,
				forceDelete
			);
		}

		return [];
	}

	/**
	 * Aggregates, saves new time slots, and deletes old ones.
	 *
	 * @param groupedTimeSlots - The grouped time slots by rounded start time
	 * @param tenantId - Tenant ID associated with the time slots
	 * @param organizationId - Organization ID associated with the time slots
	 * @param employeeId - Employee ID associated with the time slots
	 * @param forceDelete - Flag to force deletion of old time slots
	 * @returns An array of created time slots
	 */
	private async mergeAndSaveTimeSlots(
		groupedTimeSlots: Record<string, ITimeSlot[]>,
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		forceDelete: boolean
	): Promise<ITimeSlot[]> {
		const newTimeSlots: ITimeSlot[] = [];

		await Promise.all(
			Object.entries(groupedTimeSlots).map(async ([start, slots]) => {
				// Create a new TimeSlot instance with aggregated data
				const newTimeSlot = await this.createNewTimeSlot(slots, start, tenantId, organizationId, employeeId);

				// Update time logs and recalculate total worked hours for the employee
				await this.updateTimeLogAndEmployeeTotalWorkedHours(newTimeSlot);

				// Clean up old time slots if needed
				await this.cleanUpOldTimeSlots(slots, forceDelete);

				newTimeSlots.push(newTimeSlot);
			})
		);

		return newTimeSlots;
	}

	/**
	 * Rounds start and end dates to the nearest 10 minutes and returns the formatted date range.
	 *
	 * @param start - Start date of the range
	 * @param end - End date of the range
	 * @returns The formatted start and end dates
	 */
	private getRoundedDateRange(start: Date, end: Date): DateRange {
		const startDate = this.roundToNearestTenMinutes(moment(start).utc());
		const endDate = this.roundToNearestTenMinutes(moment(end).utc().add(10, 'minutes'));
		return getDateRangeFormat(startDate, endDate);
	}

	/**
	 * Group time slots by their start time
	 * @param timeSlots - The array of time slots to group
	 * @returns An object where keys are the start times and values are arrays of time slots
	 */
	private groupTimeSlots(timeSlots: ITimeSlot[]): Record<string, ITimeSlot[]> {
		return chain(timeSlots)
			.groupBy((slot) => this.roundToNearestTenMinutes(moment(slot.startedAt)).format('YYYY-MM-DD HH:mm:ss'))
			.value();
	}

	/**
	 * Creates a new TimeSlot instance by aggregating data from multiple time slots.
	 * Calculates the overall duration, keyboard, mouse, and activity metrics, and
	 * creates a new `TimeSlot` entity with aggregated screenshots, activities, and time logs.
	 *
	 * @param slots - The array of time slots to aggregate data from
	 * @param startedAt - The start time for the new aggregated time slot
	 * @param tenantId - The tenant ID associated with the time slot
	 * @param organizationId - The organization ID associated with the time slot
	 * @param employeeId - The employee ID associated with the time slot
	 * @returns A new `TimeSlot` instance with aggregated data
	 */
	private async createNewTimeSlot(
		slots: ITimeSlot[],
		startedAt: string,
		tenantId: ID,
		organizationId: ID,
		employeeId: ID
	): Promise<TimeSlot> {
		const [slot] = slots; // Get the first time slot and aggregate data from all time slots
		const aggregated = this.aggregateTimeSlot(slots); // Aggregate data from all time slots

		// Create new TimeSlot instance with aggregated data
		const newTimeSlot = new TimeSlot({
			...omit(slot),
			...this.calculateActivity(aggregated, slots), // Calculate activity metrics
			screenshots: this.mapScreenshots(aggregated.screenshots), // Map old screenshots
			activities: this.mapActivities(aggregated.activities), // Map old activities
			timeLogs: this.mapUniqueTimeLogs(aggregated.timeLogs), // Deduplicate time logs
			startedAt: moment(startedAt).toDate(),
			tenantId,
			organizationId,
			employeeId
		});

		this.debug(() => `Newly Created Time Slot with Aggregated Data: ${JSON.stringify(newTimeSlot)}`);
		// Save the new time slot to the database
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				await this.saveMergedTimeSlotWithMikroOrm(newTimeSlot, slots);
				return newTimeSlot;
			case MultiORMEnum.TypeORM:
			default:
				return await this.saveMergedTimeSlotWithTypeOrm(newTimeSlot, slots);
		}
	}

	/**
	 * Saves a merged time slot under TypeORM: the kept slot (the first of the group) takes the aggregated values and
	 * every time log of the group through `save()`, and the screenshots and activities of the other slots move onto
	 * it in ONE statement per table.
	 *
	 * They used to move through the relations' cascade, which read every child back to diff it and then wrote one
	 * `UPDATE ... WHERE id = ?` per child: 118,938 of those a month on production, one per activity ever merged,
	 * issued while the tracker's time-slot request waited (and held its pooled connection).
	 *
	 * @param newTimeSlot - The merged time slot, carrying the kept slot's id and the group's children
	 * @param slots - The time slots of the group, the kept one first
	 * @returns The saved slot, listing the moved screenshots and activities as the cascade used to
	 */
	private async saveMergedTimeSlotWithTypeOrm(newTimeSlot: TimeSlot, slots: ITimeSlot[]): Promise<TimeSlot> {
		const { screenshots, activities } = newTimeSlot;
		// Left off the saved slot: the cascade would otherwise rewrite them one by one (and detach the kept slot's
		// own children that are not in the list).
		let slotToSave = Object.assign(Object.create(Object.getPrototypeOf(newTimeSlot)), newTimeSlot) as TimeSlot;
		delete slotToSave.screenshots;
		delete slotToSave.activities;

		const mergedSlotIds = pluck(slots.slice(1), 'id') as ID[];
		// What the cascade's updates carried: the new slot, the author (the subscriber sets it on an entity save,
		// not on a statement) and `updatedAt`, which the update builder sets on its own.
		const updatedByUserId = RequestContext.currentUserId();
		const changes = { timeSlotId: newTimeSlot.id, ...(updatedByUserId ? { updatedByUserId } : {}) };

		// One transaction, as the cascading save was: a child update that fails (a lock timeout) must not leave the
		// kept slot holding the group's totals while the merged slots still exist to be counted again.
		let saved = await this.typeOrmTimeSlotRepository.manager.transaction(async (manager) => {
			const savedSlot = await manager.save(TimeSlot, slotToSave);
			if (isNotEmpty(mergedSlotIds)) {
				for (const target of [Screenshot, Activity]) {
					// Without the entity listeners: they run on the SET values of a statement as if those were the
					// whole row, and ActivitySubscriber would then stamp every moved activity's `recordedAt` with the
					// merge time (it derives a missing one from `date` + `time`, else now).
					await manager
						.createQueryBuilder()
						.update(target)
						.set(changes)
						.where({ timeSlotId: In(mergedSlotIds) })
						.callListeners(false)
						.execute();
				}
			}
			return savedSlot;
		});

		saved.screenshots = screenshots;
		saved.activities = activities;
		return saved;
	}

	/**
	 * Saves a merged time slot under MikroORM as TypeORM's `save()` does: the kept slot (the first of the group)
	 * takes the aggregated values and every time log of the group, and the screenshots and activities of the other
	 * slots move onto it before those slots are cleaned up.
	 *
	 * The merged slot itself is not persisted: it carries the kept slot's id without being managed, so MikroORM
	 * inserted it as a new row and refused its time logs, which are plain serialized objects.
	 *
	 * @param newTimeSlot - The merged time slot, carrying the kept slot's id
	 * @param slots - The time slots of the group, the kept one first
	 */
	private async saveMergedTimeSlotWithMikroOrm(newTimeSlot: TimeSlot, slots: ITimeSlot[]): Promise<void> {
		const { id, tenantId, organizationId, employeeId } = newTimeSlot;
		const em = this.mikroOrmTimeSlotRepository.getEntityManager();

		const timeSlot = await em.findOneOrFail(
			TimeSlot,
			{ id, tenantId, organizationId, employeeId },
			{ populate: ['timeLogs'] }
		);
		em.assign(timeSlot, {
			duration: newTimeSlot.duration,
			keyboard: newTimeSlot.keyboard,
			mouse: newTimeSlot.mouse,
			overall: newTimeSlot.overall,
			startedAt: newTimeSlot.startedAt,
			// By id, so the stored time logs are linked rather than rebuilt from their serialized copies
			timeLogs: pluck(newTimeSlot.timeLogs, 'id')
		});

		const mergedSlotIds = pluck(slots.slice(1), 'id');
		if (isNotEmpty(mergedSlotIds)) {
			// Through the relation: MikroORM does not write the `timeSlotId` mirror
			await em.nativeUpdate(Screenshot, { timeSlot: { $in: mergedSlotIds } }, { timeSlot: id });
			await em.nativeUpdate(Activity, { timeSlot: { $in: mergedSlotIds } }, { timeSlot: id });
		}

		await em.flush();

		if (isNotEmpty(mergedSlotIds)) {
			// nativeUpdate bypasses the identity map, where getTimeSlots already loaded these collections, and an
			// initialized collection is not reloaded by a later populate: refresh them so a read in the same request
			// (CreateTimeSlotHandler's findOne) returns the moved screenshots and activities too
			await em.populate(timeSlot, ['screenshots', 'activities'], { refresh: true });
		}
	}

	/**
	 * Deletes or soft-deletes old time slots based on the `forceDelete` flag.
	 *
	 * @param slots - Array of time slots to clean up
	 * @param forceDelete - Flag to indicate if deletion should be permanent
	 */
	private async cleanUpOldTimeSlots(slots: ITimeSlot[], forceDelete: boolean) {
		try {
			const idsToDelete = pluck(slots, 'id') as string[];
			// Keep the most recent time slot by removing it from deletion
			idsToDelete.splice(0, 1);

			this.debug(() => `TimeSlots Ids Will Be Deleted: ${JSON.stringify(idsToDelete)}`);

			if (isNotEmpty(idsToDelete)) {
				switch (this.ormType) {
					case MultiORMEnum.MikroORM: {
						if (forceDelete) {
							return await this.mikroOrmTimeSlotRepository.nativeDelete({ id: { $in: idsToDelete } });
						}
						return await this.mikroOrmTimeSlotRepository.nativeUpdate({ id: { $in: idsToDelete } }, {
							deletedAt: new Date()
						} as any);
					}
					case MultiORMEnum.TypeORM:
					default: {
						if (forceDelete) {
							// Hard delete (permanent deletion)
							return await this.typeOrmTimeSlotRepository.delete({ id: In(idsToDelete) });
						}

						// Soft delete (mark records as deleted)
						return await this.typeOrmTimeSlotRepository.softDelete({ id: In(idsToDelete) });
					}
				}
			}
		} catch (error) {
			this.logger.error(`Error while cleaning up old time slots: ${error?.message ?? error}`, error?.stack);
		}
	}

	/**
	 * Aggregates data from multiple time slots into a single object.
	 * It calculates the total duration, keyboard activity, mouse activity, and overall activity,
	 * and consolidates screenshots, time logs, and activities into arrays.
	 *
	 * @param slots - An array of time slots to be aggregated.
	 * @returns An object containing aggregated duration, keyboard activity, mouse activity,
	 * overall activity, and arrays of screenshots, time logs, and activities.
	 */
	private aggregateTimeSlot(slots: ITimeSlot[]): IAggregatedTimeSlot {
		return slots.reduce(
			(acc, slot) => {
				acc.duration += this.calculateValue(slot.duration);
				acc.keyboard += this.calculateValue(slot.keyboard);
				acc.mouse += this.calculateValue(slot.mouse);
				acc.overall += this.calculateValue(slot.overall);
				acc.screenshots.push(...(slot.screenshots || []));
				acc.timeLogs.push(...(slot.timeLogs || []));
				acc.activities.push(...(slot.activities || []));
				return acc;
			},
			{
				duration: 0,
				keyboard: 0,
				mouse: 0,
				overall: 0,
				screenshots: [],
				timeLogs: [],
				activities: []
			}
		);
	}

	/**
	 * Calculates the average activity metrics from the aggregated data.
	 * It calculates average keyboard and mouse activity from time slots that contain non-zero keyboard data.
	 * It also ensures each metric (duration, overall, keyboard, mouse) is capped at a maximum of 600.
	 *
	 * @param data - Aggregated data from time slots including total keyboard, mouse, and overall activities.
	 * @returns An object containing the calculated activity metrics (duration, overall, keyboard, mouse).
	 */
	private calculateActivity(data: IAggregatedTimeSlot, slots: ITimeSlot[]) {
		const nonZeroKeyboardSlots = slots.filter((slot: ITimeSlot) => slot.keyboard > 0);
		const count = nonZeroKeyboardSlots.length; // Count the number of non-zero keyboard slots

		const keyboardAverage = count > 0 ? Math.round(data.keyboard / count) : 0;
		const mouseAverage = count > 0 ? Math.round(data.mouse / count) : 0;

		return {
			duration: Math.max(0, Math.min(600, data.duration)),
			overall: Math.max(0, Math.min(600, data.overall)),
			keyboard: Math.max(0, Math.min(600, keyboardAverage)),
			mouse: Math.max(0, Math.min(600, mouseAverage))
		};
	}

	/**
	 * Maps and prepares screenshots for a new time slot by omitting the `timeSlotId` property.
	 *
	 * @param screenshots - Array of screenshots to be mapped
	 * @returns A new array of `Screenshot` instances without `timeSlotId`
	 */
	private mapScreenshots(screenshots: IScreenshot[]): Screenshot[] {
		return screenshots.map((screenshot) => new Screenshot(omit(screenshot, ['timeSlotId'])));
	}

	/**
	 * Maps and prepares activities for a new time slot by omitting the `timeSlotId` property.
	 *
	 * @param activities - Array of activities to be mapped
	 * @returns A new array of `Activity` instances without `timeSlotId`
	 */
	private mapActivities(activities: IActivity[]): Activity[] {
		return activities.map((activity) => new Activity(omit(activity, ['timeSlotId'])));
	}

	/**
	 * Maps and deduplicates time logs by their unique ID.
	 *
	 * @param logs - Array of time logs to be mapped and deduplicated
	 * @returns Array of unique time logs
	 */
	private mapUniqueTimeLogs(logs: ITimeLog[]): ITimeLog[] {
		return uniq(logs, (log: ITimeLog) => log.id);
	}

	/**
	 * Calculates a value safely, returning 0 if the input is undefined or not a number.
	 *
	 * @param value - The value to calculate
	 * @returns The calculated value, or 0 if the input is undefined or invalid
	 */
	private calculateValue(value?: number): number {
		return Number(value) || 0;
	}

	/**
	 * Round a moment date to the nearest 10 minutes
	 *
	 * @param date - The moment date to round
	 * @returns The rounded moment date
	 */
	private roundToNearestTenMinutes(date: moment.Moment): moment.Moment {
		const minutes = date.minutes();
		return date
			.minutes(minutes - (minutes % 10))
			.seconds(0)
			.milliseconds(0);
	}

	/**
	 * Get time slots for the given date range.
	 *
	 * @param params - An object containing parameters like organizationId, employeeId, tenantId, startedAt, and stoppedAt.
	 * @returns A promise that resolves to an array of TimeSlot instances.
	 */
	private async getTimeSlots({ organizationId, employeeId, tenantId, startedAt, stoppedAt }): Promise<TimeSlot[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmTimeSlotRepository.find(
					{
						tenantId,
						organizationId,
						employeeId,
						startedAt: { $gte: moment.utc(startedAt).toDate(), $lt: moment.utc(stoppedAt).toDate() }
					},
					{
						populate: ['timeLogs', 'screenshots', 'activities'],
						orderBy: { createdAt: 'ASC' } as any
					}
				);
				return items.map((item) => wrapSerialize(item)) as TimeSlot[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeSlot entity
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
				query
					.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs')
					.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots')
					.leftJoinAndSelect(`${query.alias}.activities`, 'activities');
				query
					.where(
						p(`"${query.alias}"."startedAt" >= :startedAt AND "${query.alias}"."startedAt" < :stoppedAt`),
						{
							startedAt,
							stoppedAt
						}
					)
					.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId })
					.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId })
					.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId })
					.addOrderBy(p(`"${query.alias}"."createdAt"`), 'ASC');

				this.debug(() => `GET Time Slots Query: ${JSON.stringify(query.getQueryAndParameters())}`);
				// Execute the query and return the results
				return await query.getMany();
			}
		}
	}

	/**
	 * Updates time logs and recalculates the total worked hours for an employee based on the given time slot.
	 *
	 * @param newTimeSlot - The newly created time slot containing time logs and employee information.
	 */
	private async updateTimeLogAndEmployeeTotalWorkedHours(newTimeSlot: ITimeSlot): Promise<void> {
		/**
		 * Update TimeLog Entry Every TimeSlot Request From Desktop Timer
		 * RECALCULATE timesheet activity
		 */
		// Once per timesheet: the time logs of one slot mostly belong to the same one.
		const timesheetIds = uniq(pluck(newTimeSlot.timeLogs ?? [], 'timesheetId').filter(Boolean)) as ID[];
		for (const timesheetId of timesheetIds) {
			await this.commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
		}

		/**
		 * UPDATE employee total worked hours
		 */
		if (newTimeSlot.employeeId) {
			await this.commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(newTimeSlot.employeeId));
		}
	}

	/**
	 * Diagnostic trace of the merge, at debug level: the message is built only when debug logging is on (these
	 * ran as unconditional console output before, the merged slot dumped with its screenshots and activities on
	 * every tracker time-slot write).
	 *
	 * @param message - Builds the message to be logged.
	 */
	private debug(message: () => string): void {
		if (Logger.isLevelEnabled('debug')) {
			this.logger.debug(message());
		}
	}
}
