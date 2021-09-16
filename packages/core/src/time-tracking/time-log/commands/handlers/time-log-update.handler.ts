import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ITimeLog, ITimesheet, TimeLogSourceEnum } from '@gauzy/contracts';
import { TimeLog } from './../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import {
	TimesheetFirstOrCreateCommand,
	TimesheetRecalculateCommand
} from './../../../timesheet/commands';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { RequestContext } from './../../../../core/context';

@CommandHandler(TimeLogUpdateCommand)
export class TimeLogUpdateHandler
	implements ICommandHandler<TimeLogUpdateCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeLogUpdateCommand): Promise<TimeLog> {
		const { id, input, manualTimeSlot } = command;

		let timeLog: ITimeLog;
		if (id instanceof TimeLog) {
			timeLog = id;
		} else {
			timeLog = await this.timeLogRepository.findOne(id);
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
				new TimesheetFirstOrCreateCommand(
					input.startedAt,
					employeeId,
					organizationId
				)
			);
			const { startedAt, stoppedAt } = Object.assign({}, timeLog, input);
			updateTimeSlots = this.timeSlotService.generateTimeSlots(
				startedAt,
				stoppedAt
			);
		}

		await this.timeLogRepository.update(timeLog.id, {
			...input,
			...(timesheet ? { timesheetId: timesheet.id } : {})
		});

		timeLog = await this.timeLogRepository.findOne(timeLog.id);
		const { timesheetId } = timeLog;

		const timeSlots = this.timeSlotService.generateTimeSlots(
			timeLog.startedAt,
			timeLog.stoppedAt
		);
		
		if (needToUpdateTimeSlots) {
			const startTimes = timeSlots
				.filter((timeslot) => {
					return (
						updateTimeSlots.filter(
							(newSlot) =>
								newSlot.startedAt.getTime() ===
								timeslot.startedAt.getTime()
						).length === 0
					);
				})
				.map((timeslot) => new Date(timeslot.startedAt));

			if (startTimes.length > 0) {
				await this.timeSlotService.delete({
					organizationId,
					tenantId,
					employeeId: timeLog.employeeId,
					startedAt: In(startTimes)
				});
			}

			if (!manualTimeSlot && timeLog.source === TimeLogSourceEnum.BROWSER) {
				updateTimeSlots = updateTimeSlots
					.map((slot) => ({
						...slot,
						employeeId,
						organizationId,
						tenantId,
						keyboard: 0,
						mouse: 0,
						overall: 0
					}))
					.filter((slot) => slot.tenantId && slot.organizationId);

				const timeSlots = await this.timeSlotService.bulkCreate(updateTimeSlots);
				timeLog.timeSlots = timeSlots;
			}

			this.timeLogRepository.save(timeLog);

			/**
			 * RECALCULATE timesheet activity  
			 */
			await this.commandBus.execute(
				new TimesheetRecalculateCommand(timesheetId)
			);

			/**
			 * UPDATE employee total worked hours
			 */
			if (employeeId) {
				await this.commandBus.execute(
					new UpdateEmployeeTotalWorkedHoursCommand(employeeId)
				);
			}
		}
		
		return await this.timeLogRepository.findOne(timeLog.id);
	}
}
