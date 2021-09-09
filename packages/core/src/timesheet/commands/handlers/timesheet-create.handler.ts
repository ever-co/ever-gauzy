import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimesheet } from '@gauzy/contracts';
import { TimesheetCreateCommand } from '..';
import { TimeSheetService } from './../../timesheet.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(TimesheetCreateCommand)
export class TimesheetCreateHandler
	implements ICommandHandler<TimesheetCreateCommand> {

	constructor(
		private readonly _timesheetService: TimeSheetService
	) {}

	public async execute(command: TimesheetCreateCommand): Promise<ITimesheet> {
		const { input } = command;
		const {
			employeeId,
			duration,
			keyboard,
			mouse,
			overall,
			startedAt,
			stoppedAt,
			organizationId
		} = input;

		try {
			const tenantId = RequestContext.currentTenantId();
			return await this._timesheetService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt,
				stoppedAt,
				organizationId,
				tenantId
			});
		} catch (error) {
			throw new BadRequestException(
				`Can\'t create timesheet for employee-${employeeId} of organization-${organizationId}`
			);
		}
	}
}
