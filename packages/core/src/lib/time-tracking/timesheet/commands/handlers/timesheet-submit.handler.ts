import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { Repository, In, Not, IsNull } from 'typeorm';
import { ITimesheet } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { Timesheet } from './../../timesheet.entity';
import { TimesheetSubmitCommand } from '../timesheet-submit.command';

@CommandHandler(TimesheetSubmitCommand)
export class TimesheetSubmitHandler implements ICommandHandler<TimesheetSubmitCommand> {
	constructor(
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly emailService: EmailService
	) {}

	public async execute(command: TimesheetSubmitCommand): Promise<ITimesheet[]> {
		const { input } = command;
		let { ids, status, organizationId } = input;
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You can not submit timesheet');
		}
		if (typeof ids === 'string') {
			ids = [ids];
		}
		await this.timeSheetRepository.update(
			{
				id: In(ids),
				organizationId,
				tenantId: RequestContext.currentTenantId()
			},
			{
				...(status === 'submit'
					? {
							submittedAt: new Date()
					  }
					: {
							submittedAt: null
					  })
			}
		);
		const timesheets = await this.timeSheetRepository.find({
			relations: {
				employee: {
					user: true
				}
			},
			where: {
				id: In(ids),
				organizationId,
				tenantId: RequestContext.currentTenantId(),
				submittedAt: Not(IsNull())
			},
			select: {
				employee: {
					id: true,
					organizationId: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						email: true
					}
				}
			}
		});
		timesheets.forEach((timesheet) => {
			if (status === 'submit') {
				if (timesheet.employee && timesheet.employee.user) {
					this.emailService.timesheetSubmit(timesheet.employee.user.email, timesheet);
				}
			}
		});
		return timesheets;
	}
}
