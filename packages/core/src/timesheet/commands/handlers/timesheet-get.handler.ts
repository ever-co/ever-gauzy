import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSheetService } from '../../timesheet/timesheet.service';
import { ITimesheet } from '@gauzy/contracts';
import { TimesheetGetCommand } from '..';

@CommandHandler(TimesheetGetCommand)
export class TimesheetGetHandler
	implements ICommandHandler<TimesheetGetCommand> {
	constructor(private readonly _timesheetService: TimeSheetService) {}

	public async execute(command: TimesheetGetCommand): Promise<ITimesheet> {
		const { input } = command;

		const { record } = await this._timesheetService.findOneOrFail(input);
		return record;
	}
}
