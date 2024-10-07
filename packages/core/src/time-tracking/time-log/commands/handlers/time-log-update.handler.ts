import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimeLog, ITimesheet, TimeLogSourceEnum } from '@gauzy/contracts';
import { TimeLog } from './../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { RequestContext } from './../../../../core/context';
import { TimeSlot } from './../../../../core/entities/internal';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

@CommandHandler(TimeLogUpdateCommand)
export class TimeLogUpdateHandler implements ICommandHandler<TimeLogUpdateCommand> {
	constructor(
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeLogUpdateCommand): Promise<TimeLog> {
		const { id, input, manualTimeSlot } = command;

		let timeLog: ITimeLog;
		if (id instanceof TimeLog) {
			timeLog = id;
		} else {
			timeLog = await this.typeOrmTimeLogRepository.findOneBy({ id });
		}

		const tenantId = RequestContext.currentTenantId();
		const { employeeId, organizationId } = timeLog;

		let needToUpdateTimeSlots = false;
		if (input.startedAt || input.stoppedAt) {
			needToUpdateTimeSlots = true;
		}

		let timesheet: ITimesheet;
		let updateTimeSlots = [];

		if (needToUpdateTimeSlots) {
			timesheet = await this.commandBus.execute(
				new TimesheetFirstOrCreateCommand(input.startedAt, employeeId, organizationId)
			);
			const { startedAt, stoppedAt } = Object.assign({}, timeLog, input);
			updateTimeSlots = this.timeSlotService.generateTimeSlots(startedAt, stoppedAt);
		}

		console.log('Stopped Timer Request Updated TimeLog Request', {
			input
		});

		await this.typeOrmTimeLogRepository.update(timeLog.id, {
			...input,
			...(timesheet ? { timesheetId: timesheet.id } : {})
		});

		const timeSlots = this.timeSlotService.generateTimeSlots(timeLog.startedAt, timeLog.stoppedAt);

		timeLog = await this.typeOrmTimeLogRepository.findOneBy({
			id: timeLog.id
		});
		const { timesheetId } = timeLog;

		if (needToUpdateTimeSlots) {
			const startTimes = timeSlots
				.filter((timeSlot) => {
					return (
						updateTimeSlots.filter((newSlot) => moment(newSlot.startedAt).isSame(timeSlot.startedAt))
							.length === 0
					);
				})
				.map((timeSlot) => new Date(timeSlot.startedAt));

			if (startTimes.length > 0) {
				/**
				 * Removed Deleted TimeSlots
				 */
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');
				query.setFindOptions({
					relations: {
						screenshots: true
					}
				});
				query.where((qb: SelectQueryBuilder<TimeSlot>) => {
					qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
						organizationId
					});
					qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
						tenantId
					});
					qb.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), {
						employeeId
					});
					qb.andWhere(p(`"${qb.alias}"."startedAt" IN (:...startTimes)`), {
						startTimes
					});
				});
				const timeSlots = await query.getMany();
				await this.typeOrmTimeSlotRepository.remove(timeSlots);
			}

			if (!manualTimeSlot && timeLog.source === TimeLogSourceEnum.WEB_TIMER) {
				updateTimeSlots = updateTimeSlots
					.map((slot) => ({
						...slot,
						employeeId,
						organizationId,
						tenantId,
						keyboard: 0,
						mouse: 0,
						overall: 0,
						timeLogId: timeLog.id
					}))
					.filter((slot) => slot.tenantId && slot.organizationId);
				/**
				 * Assign regenerated TimeSlot entries for existed TimeLog
				 */
				await this.timeSlotService.bulkCreate(updateTimeSlots, employeeId, organizationId);
			}

			console.log('Last Updated Timer Time Log', { timeLog });

			/**
			 * Update TimeLog Entry
			 */
			try {
				await this.typeOrmTimeLogRepository.save(timeLog);
			} catch (error) {
				console.error('Error while updating TimeLog', error);
			}

			/**
			 * RECALCULATE timesheet activity
			 */
			await this.commandBus.execute(new TimesheetRecalculateCommand(timesheetId));

			/**
			 * UPDATE employee total worked hours
			 */
			if (employeeId) {
				await this.commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
			}
		}

		return await this.typeOrmTimeLogRepository.findOneBy({
			id: timeLog.id
		});
	}
}
