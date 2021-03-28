import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TimeLog } from '../../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { Timesheet } from '../../../timesheet.entity';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands/timesheet-first-or-create.command';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands/timesheet-recalculate.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';

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
		let timeLog: TimeLog;
		if (id instanceof TimeLog) {
			timeLog = id;
		} else {
			timeLog = await this.timeLogRepository.findOne(id);
		}

		const updatedTimeLog = Object.assign({}, timeLog, input);

		const timeSlots = this.timeSlotService.generateTimeSlots(
			timeLog.startedAt,
			timeLog.stoppedAt
		);

		let timesheet: Timesheet;
		let updateTimeSlots = [];
		let needToUpdateTimeSlots = false;
		if (input.startedAt || input.stoppedAt) {
			needToUpdateTimeSlots = true;
		}

		if (needToUpdateTimeSlots) {
			timesheet = await this.commandBus.execute(
				new TimesheetFirstOrCreateCommand(
					input.startedAt,
					timeLog.employeeId
				)
			);

			updateTimeSlots = this.timeSlotService.generateTimeSlots(
				updatedTimeLog.startedAt,
				updatedTimeLog.stoppedAt
			);
		}

		await this.timeLogRepository.update(timeLog.id, {
			...input,
			...(timesheet ? { timesheetId: timesheet.id } : {})
		});

		timeLog = await this.timeLogRepository.findOne(timeLog.id);

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
					employeeId: timeLog.employeeId,
					startedAt: In(startTimes)
				});
			}

			updateTimeSlots = updateTimeSlots
				.map((slot) => ({
					...slot,
					employeeId: timeLog.employeeId,
					keyboard: 0,
					mouse: 0,
					overall: 0
				}))
				.filter((slot) => slot.tenantId && slot.organizationId);

			if (!manualTimeSlot) {
				updateTimeSlots = await this.timeSlotService.bulkCreate(
					updateTimeSlots
				);
			}

			timeLog.timeSlots = updateTimeSlots;
			this.timeLogRepository.save(timeLog);

			await this.commandBus.execute(
				new TimesheetRecalculateCommand(timeLog.timesheetId)
			);

			await this.commandBus.execute(
				new UpdateEmployeeTotalWorkedHoursCommand(timeLog.employeeId)
			);
		}

		return timeLog;
	}
}
