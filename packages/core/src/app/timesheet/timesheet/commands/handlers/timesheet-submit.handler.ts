import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmailService } from '../../../../../app/email/email.service';
import { Timesheet } from '../../../timesheet.entity';
import { TimesheetSubmitCommand } from '../timesheet-submit.command';

@CommandHandler(TimesheetSubmitCommand)
export class TimesheetSubmitHandler
	implements ICommandHandler<TimesheetSubmitCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly emailService: EmailService
	) {}

	public async execute(
		command: TimesheetSubmitCommand
	): Promise<Timesheet[]> {
		let { ids, status } = command.input;

		if (typeof ids === 'string') {
			ids = [ids];
		}
		await this.timeSheetRepository.update(
			{
				id: In(ids)
			},
			{
				submittedAt: status === 'submit' ? new Date() : null
			}
		);

		const timesheets = await this.timeSheetRepository.find({
			relations: ['employee', 'employee.user'],
			where: {
				id: In(ids)
			}
		});
		timesheets.forEach((timesheet) => {
			if (status === 'submit') {
				if (timesheet.employee && timesheet.employee.user) {
					this.emailService.timesheetSubmit(
						timesheet.employee.user.email,
						timesheet
					);
				}
			}
		});

		return timesheets;
	}
}
