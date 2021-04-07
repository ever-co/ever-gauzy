import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLogType, TimeLogSourceEnum } from '@gauzy/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { Repository } from 'typeorm';
import { TimeLog } from '../../../time-log.entity';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands/timesheet-first-or-create.command';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands/timesheet-recalculate.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { RequestContext } from '../../../../core/context';

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
			startedAt: moment.utc(input.startedAt).toDate(),
			...(input.stoppedAt
				? { stoppedAt: moment.utc(input.stoppedAt).toDate() }
				: {}),
			timesheetId: timesheet.id,
			organizationId: input.organizationId,
			employeeId: input.employeeId,
			projectId: input.projectId || null,
			taskId: input.taskId || null,
			organizationContactId: input.organizationContactId || null,
			logType: input.logType || TimeLogType.MANUAL,
			description: input.description || '',
			reason: input.reason || '',
			isBillable: input.isBillable || false,
			source: input.source || TimeLogSourceEnum.BROWSER
		});

		let timeSlots = [];
		if (input.stoppedAt) {
			timeSlots = this.timeSlotService.generateTimeSlots(
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
		}

		if (input.timeSlots) {
			/*
			 * Merge blank timeslot if missing in request.
			 * I.e
			 * Time Logs is : 04:00:00 to  05:00:00 and pass time slots for 04:00:00, 04:20:00, 04:30:00, 04:40:00
			 * then it will add  04:10:00,  04:50:00 as blank time slots in array to instert
			 */
			input.timeSlots = input.timeSlots.map((timeSlot) => {
				timeSlot.startedAt = moment.utc(input.startedAt).toDate();
				timeSlot.employeeId = input.employeeId;
				return timeSlot;
			});

			timeSlots = timeSlots.map((blankTimeSlot) => {
				let timeSlot = input.timeSlots.find((requestTimeSlot) => {
					return (
						moment
							.utc(requestTimeSlot.startedAt)
							.format('YYYY-MM-DD HH:mm') ===
						moment
							.utc(blankTimeSlot.startedAt)
							.format('YYYY-MM-DD HH:mm')
					);
				});

				timeSlot = timeSlot ? timeSlot : blankTimeSlot;
				timeSlot.employeeId = input.employeeId;

				return timeSlot;
			});
		}

		newTimeLog.timeSlots = await this.timeSlotService.bulkCreate(timeSlots);

		newTimeLog.tenantId = RequestContext.currentTenantId();

		await this.timeLogRepository.save(newTimeLog);
		
		console.log('New Time Log:', newTimeLog);

		await this.commandBus.execute(
			new TimesheetRecalculateCommand(timesheet.id)
		);

		await this.commandBus.execute(
			new UpdateEmployeeTotalWorkedHoursCommand(newTimeLog.employeeId)
		);

		return newTimeLog;
	}
}
