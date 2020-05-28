import { Timesheet } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimesheetCreateCommand } from '..';
import { TimeSheetService } from '../../timesheet/timesheet.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(TimesheetCreateCommand)
export class TimesheetCreateHandler
	implements ICommandHandler<TimesheetCreateCommand> {
	constructor(private _timesheetService: TimeSheetService) {}

	public async execute(command: TimesheetCreateCommand): Promise<Timesheet> {
		try {
			const { input } = command;
			const {
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt
			} = input;

			return await this._timesheetService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt
			});
		} catch (error) {
			throw new BadRequestException('Cant create timesheet');
		}
	}
}
