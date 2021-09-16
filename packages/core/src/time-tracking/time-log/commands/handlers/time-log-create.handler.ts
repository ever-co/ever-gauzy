import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLogType, TimeLogSourceEnum, ITimeSlot } from '@gauzy/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { Repository } from 'typeorm';
import { TimeLog } from './../../time-log.entity';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import {
	TimesheetFirstOrCreateCommand,
	TimesheetRecalculateCommand
} from './../../../timesheet/commands';
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
		const { startedAt, employeeId, organizationId } = input;

		const tenantId = RequestContext.currentTenantId();

		const timesheet = await this.commandBus.execute(
			new TimesheetFirstOrCreateCommand(
				startedAt,
				employeeId,
				organizationId
			)
		);

		const timeLog = new TimeLog({
			startedAt: moment.utc(startedAt).toDate(),
			...(input.stoppedAt
				? { stoppedAt: moment.utc(input.stoppedAt).toDate() }
				: {}),
			timesheet,
			organizationId,
			tenantId,
			employeeId,
			projectId: input.projectId || null,
			taskId: input.taskId || null,
			organizationContactId: input.organizationContactId || null,
			logType: input.logType || TimeLogType.MANUAL,
			description: input.description || null,
			reason: input.reason || null,
			isBillable: input.isBillable || false,
			source: input.source || TimeLogSourceEnum.BROWSER
		});

		let timeSlots: ITimeSlot[] = [];
		if (input.stoppedAt) {
			timeSlots = this.timeSlotService.generateTimeSlots(
				input.startedAt,
				input.stoppedAt
			).map((slot) => ({
				...slot,
				employeeId,
				organizationId,
				tenantId,
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
			input.timeSlots = input.timeSlots.map((timeSlot: ITimeSlot) => {
				timeSlot.startedAt = moment.utc(startedAt).toDate();
				timeSlot.employeeId = employeeId;
				timeSlot.organizationId = organizationId;
				timeSlot.tenantId = tenantId;
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

		timeLog.timeSlots = await this.timeSlotService.bulkCreate(timeSlots);

		await this.timeLogRepository.save(timeLog);

		/**
		 * RECALCULATE timesheet activity  
		 */
		if (timesheet) {
			const { id: timesheetId } = timesheet;
			await this.commandBus.execute(
				new TimesheetRecalculateCommand(timesheetId)
			);
		}

		/**
		 * UPDATE employee total worked hours
		 */
		await this.commandBus.execute(
			new UpdateEmployeeTotalWorkedHoursCommand(employeeId)
		);
		
		return await this.timeLogRepository.findOne(timeLog.id);
	}
}
