import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimesheet } from '@gauzy/contracts';
import { TimeSheetService } from './../../../timesheet/timesheet.service';
import { TimesheetGetCommand } from './../timesheet-get.command';

@CommandHandler(TimesheetGetCommand)
export class TimesheetGetHandler
	implements ICommandHandler<TimesheetGetCommand> {
	constructor(private readonly _timesheetService: TimeSheetService) {}

	public async execute(command: TimesheetGetCommand): Promise<ITimesheet> {
		const { input } = command;

		const { record } = await this._timesheetService.findOneOrFailByOptions(input);
		return record;
	}
}
