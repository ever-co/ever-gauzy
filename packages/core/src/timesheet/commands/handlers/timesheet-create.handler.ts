import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimesheet } from '@gauzy/contracts';
import { TimesheetCreateCommand } from '..';
import { TimeSheetService } from './../../../timesheet/timesheet.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(TimesheetCreateCommand)
export class TimesheetCreateHandler
	implements ICommandHandler<TimesheetCreateCommand> {
	constructor(private _timesheetService: TimeSheetService) {}

	public async execute(command: TimesheetCreateCommand): Promise<ITimesheet> {
		try {
			const { input } = command;
			const {
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt,
				organizationId
			} = input;

			const tenantId = RequestContext.currentTenantId();
			return await this._timesheetService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt,
				organizationId,
				tenantId
			});
		} catch (error) {
			throw new BadRequestException('Cant create timesheet');
		}
	}
}
