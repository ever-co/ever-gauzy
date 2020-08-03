import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TimesheetFirstOrCreateCommand } from '../timesheet-first-or-create.command';
import { Timesheet } from '../../../timesheet.entity';
import * as moment from 'moment';

@CommandHandler(TimesheetFirstOrCreateCommand)
export class TimesheetFirstOrCreateHandler
	implements ICommandHandler<TimesheetFirstOrCreateCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>
	) {}

	public async execute(
		command: TimesheetFirstOrCreateCommand
	): Promise<Timesheet> {
		const { date, employeeId } = command;

		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timeSheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		if (!timesheet) {
			timesheet = await this.timeSheetRepository.save({
				employeeId: employeeId,
				startedAt: from_date.toISOString(),
				stoppedAt: to_date.toISOString()
			});
		}
		return timesheet;
	}
}
