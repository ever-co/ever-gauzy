import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimesheet } from '@gauzy/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TimeSheetService } from '../../timesheet.service';
import { TimesheetRecalculateCommand } from '../timesheet-recalculate.command';
import { TimeSlot } from './../../../../core/entities/internal';
import { RequestContext } from './../../../../core/context';

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
	): Promise<ITimesheet> {
		const { id } = command;
		const tenantId = RequestContext.currentTenantId();
		const timesheet = await this.timesheetService.findOneByIdString(id);
		
		const timeSlot = await this.timeSlotRepository
			.createQueryBuilder()
			.select('SUM(duration)', 'duration')
			.addSelect('AVG(keyboard)', 'keyboard')
			.addSelect('AVG(mouse)', 'mouse')
			.addSelect('AVG(overall)', 'overall')
			.where({
				startedAt: Between(timesheet.startedAt, timesheet.stoppedAt),
				employeeId: timesheet.employeeId,
				organizationId: timesheet.organizationId,
				tenantId
			})
			.getRawOne();

		await this.timesheetService.update(id, {
			duration: Math.round(timeSlot.duration),
			keyboard: Math.round(timeSlot.keyboard),
			mouse: Math.round(timeSlot.mouse),
			overall: Math.round(timeSlot.overall)
		});

		return timesheet;
	}
}
