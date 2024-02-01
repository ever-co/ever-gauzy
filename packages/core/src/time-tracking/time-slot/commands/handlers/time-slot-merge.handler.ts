import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { chain, omit, uniq } from 'underscore';
import { IActivity, IScreenshot, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { Activity, Screenshot, TimeSlot } from './../../../../core/entities/internal';
import { RequestContext } from './../../../../core/context';
import { getDateRangeFormat } from './../../../../core/utils';
import { roundDownToNearest10Minutes } from '../../utils';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { UpdateEmployeeTotalWorkedHoursCommand } from './../../../../employee/commands';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(TimeSlotMergeCommand)
export class TimeSlotMergeHandler implements ICommandHandler<TimeSlotMergeCommand> {

	constructor(
		@InjectRepository(TimeSlot)
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,

		private readonly commandBus: CommandBus
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: TimeSlotMergeCommand) {
		let { organizationId, employeeId, start, end } = command;
		const tenantId = RequestContext.currentTenantId();

		const { start: startedAt, end: stoppedAt } = getDateRangeFormat(
			roundDownToNearest10Minutes(moment.utc(start)),
			roundDownToNearest10Minutes(moment.utc(end)).add(10, 'minutes')
		);
		console.log({ startedAt, stoppedAt }, 'Time Slot Merging Dates');

		// GET Time Slots for the given date range slot
		const timeSlots = await this.getTimeSlots({
			organizationId,
			employeeId,
			tenantId,
			startedAt,
			stoppedAt
		});

		const createdTimeSlots: ITimeSlot[] = [];

		if (isNotEmpty(timeSlots)) {
			const groupByTimeSlots = chain(timeSlots).groupBy((timeSlot: ITimeSlot) =>
				moment(timeSlot.startedAt).startOf('minute').subtract(moment().minute() % 10, 'minutes').format('YYYY-MM-DD HH:mm:ss')
			);
			const savePromises = groupByTimeSlots.mapObject(async (slots, slotStart) => {
				const [slot] = slots;

				let timeLogs: ITimeLog[] = [];
				let screenshots: IScreenshot[] = [];
				let activities: IActivity[] = [];

				let duration = 0;
				let keyboard = 0;
				let mouse = 0;
				let overall = 0;

				for (const slot of slots) {
					duration += parseInt(slot.duration as any, 10) || 0;
					keyboard += parseInt(slot.keyboard as any, 10) || 0;
					mouse += parseInt(slot.mouse as any, 10) || 0;
					overall += parseInt(slot.overall as any, 10) || 0;

					screenshots = screenshots.concat(slot.screenshots || []);
					timeLogs = timeLogs.concat(slot.timeLogs || []);
					activities = activities.concat(slot.activities || []);
				}

				const nonZeroKeyboardSlots = slots.filter((item: ITimeSlot) => item.keyboard !== 0);
				const timeSlotsLength = nonZeroKeyboardSlots.length;

				keyboard = Math.round(keyboard / timeSlotsLength || 0);
				mouse = Math.round(mouse / timeSlotsLength || 0);

				const activity = {
					duration: Math.max(0, Math.min(600, duration)),
					overall: Math.max(0, Math.min(600, overall)),
					keyboard: Math.max(0, Math.min(600, keyboard)),
					mouse: Math.max(0, Math.min(600, mouse)),
				};
				/*
				* Map old screenshots newly created TimeSlot
				*/
				screenshots = screenshots.map(
					(item) => new Screenshot(omit(item, ['timeSlotId']))
				);
				/*
				* Map old activities newly created TimeSlot
				*/
				activities = activities.map(
					(item) => new Activity(omit(item, ['timeSlotId']))
				);

				timeLogs = uniq(timeLogs, (log: ITimeLog) => log.id);

				const newTimeSlot = new TimeSlot({
					...omit(slot),
					...activity,
					screenshots,
					activities,
					timeLogs,
					startedAt: moment(slotStart).toDate(),
					tenantId,
					organizationId,
					employeeId
				});
				console.log('Newly Created Time Slot', newTimeSlot);

				await this.updateTimeLogAndEmployeeTotalWorkedHours(newTimeSlot);

				await this.typeOrmTimeSlotRepository.save(newTimeSlot);
				createdTimeSlots.push(newTimeSlot);

				const ids = slots.map((slot: ITimeSlot) => slot.id).slice(1);
				console.log('TimeSlots Ids Will Be Deleted:', ids);

				if (isNotEmpty(ids)) {
					await this.typeOrmTimeSlotRepository.delete({ id: In(ids) });
				}
			}).values().value();
			await Promise.all(savePromises);
		}
		return createdTimeSlots;
	}

	/**
	 * Get time slots for the given date range.
	 *
	 * @param param0 - An object containing parameters like organizationId, employeeId, tenantId, startedAt, and stoppedAt.
	 * @returns A promise that resolves to an array of TimeSlot instances.
	 */
	private async getTimeSlots({
		organizationId,
		employeeId,
		tenantId,
		startedAt,
		stoppedAt
	}): Promise<TimeSlot[]> {
		/**
		 * GET Time Slots for given date range slot
		 */
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
		query.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots');
		query.leftJoinAndSelect(`${query.alias}.activities`, 'activities');
		query.where((qb: SelectQueryBuilder<TimeSlot>) => {
			qb.andWhere(p(`"${qb.alias}"."startedAt" >= :startedAt AND "${qb.alias}"."startedAt" < :stoppedAt`), {
				startedAt,
				stoppedAt
			});
			qb.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), {
				employeeId
			});
			qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
				organizationId
			});
			qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
				tenantId
			});
		});
		query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'ASC');
		const timeSlots = await query.getMany();
		return timeSlots
	}

	/**
	 *
	 * @param newTimeSlot
	 */
	private async updateTimeLogAndEmployeeTotalWorkedHours(newTimeSlot: ITimeSlot): Promise<void> {
		/**
		 * Update TimeLog Entry Every TimeSlot Request From Desktop Timer
		 * RECALCULATE timesheet activity
		 */
		for await (const timeLog of newTimeSlot.timeLogs) {
			await this.commandBus.execute(
				new TimesheetRecalculateCommand(timeLog.timesheetId)
			);
		}

		/**
		 * UPDATE employee total worked hours
		 */
		if (newTimeSlot.employeeId) {
			await this.commandBus.execute(
				new UpdateEmployeeTotalWorkedHoursCommand(
					newTimeSlot.employeeId
				)
			);
		}
	}
}
