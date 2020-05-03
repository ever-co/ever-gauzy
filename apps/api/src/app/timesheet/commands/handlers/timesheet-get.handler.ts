import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSheetService } from '../../timesheet.service';
import { Timesheet } from '@gauzy/models';
import { TimesheetGetCommand } from '..';

@CommandHandler(TimesheetGetCommand)
export class TimesheetGetHandler
	implements ICommandHandler<TimesheetGetCommand> {
	constructor(private readonly _timesheetService: TimeSheetService) {}

	public async execute(command: TimesheetGetCommand): Promise<Timesheet> {
		const { input } = command;

		const { record } = await this._timesheetService.findOneOrFail(input);
		return record;
	}
}
