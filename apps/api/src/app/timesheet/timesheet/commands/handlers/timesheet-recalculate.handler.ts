import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSheetService } from '../../timesheet.service';
import { Timesheet } from '@gauzy/models';
import { InjectRepository } from '@nestjs/typeorm';
import { TimeSlot } from '../../../time-slot.entity';
import { Between, Repository } from 'typeorm';
import { TimesheetRecalculateCommand } from '../timesheet-recalculate.command';

@CommandHandler(TimesheetRecalculateCommand)
export class TimesheetRecalculateHandler
	implements ICommandHandler<TimesheetRecalculateCommand> {
	constructor(
		private readonly timesheetService: TimeSheetService,
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(
		command: TimesheetRecalculateCommand
	): Promise<Timesheet> {
		const { id } = command;

		const timesheet = await this.timesheetService.findOne(id);

		const timeslotsData = await this.timeSlotRepository
			.createQueryBuilder()
			.select('SUM(duration)', 'duration')
			.addSelect('AVG(keyboard)', 'keyboard')
			.addSelect('AVG(mouse)', 'mouse')
			.addSelect('AVG(overall)', 'overall')
			.where({
				startedAt: Between(timesheet.startedAt, timesheet.stoppedAt),
				employeeId: timesheet.employeeId
			})
			.getRawOne();

		await this.timesheetService.update(id, {
			duration: Math.round(timeslotsData.duration),
			keyboard: Math.round(timeslotsData.keyboard),
			mouse: Math.round(timeslotsData.mouse),
			overall: Math.round(timeslotsData.overall)
		});

		return timesheet;
	}
}
