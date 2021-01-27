import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimesheetStatus } from '@gauzy/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RequestContext } from '../../../../core/context';
import { EmailService } from '../../../../email/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { Timesheet } from '../../../timesheet.entity';

@CommandHandler(TimesheetUpdateStatusCommand)
export class TimesheetUpdateStatusHandler
	implements ICommandHandler<TimesheetUpdateStatusCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly emailService: EmailService
	) {}

	public async execute(
		command: TimesheetUpdateStatusCommand
	): Promise<Timesheet[]> {
		let { ids, status } = command.input;

		if (typeof ids === 'string') {
			ids = [ids];
		}

		let approvedBy: string = null;
		if (status === TimesheetStatus.APPROVED) {
			const user = RequestContext.currentUser();
			approvedBy = user.employeeId;
		}

		await this.timeSheetRepository.update(
			{
				id: In(ids)
			},
			{
				status: status,
				approvedById: approvedBy,
				approvedAt:
					status === TimesheetStatus.APPROVED ? new Date() : null
			}
		);

		const timesheets = await this.timeSheetRepository.find({
			relations: ['employee', 'employee.user'],
			where: {
				id: In(ids)
			}
		});
		timesheets.forEach((timesheet) => {
			if (timesheet.employee && timesheet.employee.user) {
				this.emailService.setTimesheetAction(
					timesheet.employee.user.email,
					timesheet
				);
			}
		});

		return timesheets;
	}
}
