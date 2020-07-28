import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { TimeLogType } from '@gauzy/models';
import { InjectRepository } from '@nestjs/typeorm';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands/timesheet-first-or-create.command';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands/timesheet-recalculate.command';

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler
	implements ICommandHandler<TimeLogCreateCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		const { input } = command;

		const timesheet = await this.commandBus.execute(
			new TimesheetFirstOrCreateCommand(input.startedAt, input.employeeId)
		);

		const newTimeLog = new TimeLog({
			startedAt: input.startedAt,
			stoppedAt: input.stoppedAt,
			timesheetId: timesheet.id,
			employeeId: input.employeeId,
			projectId: input.projectId || null,
			taskId: input.taskId || null,
			clientId: input.clientId || null,
			logType: input.logType || TimeLogType.MANUAL,
			description: input.description || '',
			isBillable: input.isBillable || false
		});

		let timeSlots = this.timeSlotService.generateTimeSlots(
			input.startedAt,
			input.stoppedAt
		);
		timeSlots = timeSlots.map((slot) => ({
			...slot,
			employeeId: input.employeeId,
			keyboard: 0,
			mouse: 0,
			overall: 0
		}));
		await this.timeSlotService.bulkCreate(timeSlots);
		newTimeLog.timeSlots = timeSlots;
		await this.timeLogRepository.save(newTimeLog);

		await this.commandBus.execute(
			new TimesheetRecalculateCommand(timesheet.id)
		);

		return newTimeLog;
	}
}
