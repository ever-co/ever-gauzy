import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { Timesheet } from './../../timesheet.entity';

@CommandHandler(TimesheetUpdateStatusCommand)
export class TimesheetUpdateStatusHandler
	implements ICommandHandler<TimesheetUpdateStatusCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly emailService: EmailService
	) { }

	public async execute(
		command: TimesheetUpdateStatusCommand
	): Promise<ITimesheet[]> {
		const { input } = command;
		let { ids, status, organizationId } = input;
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You can not update timesheet status');
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
				status: status,
				...(
					(status === TimesheetStatus.APPROVED) ? {
						approvedById: RequestContext.currentUserId()
					} : {}
				),
				...(
					(status === TimesheetStatus.APPROVED) ? {
						approvedAt: new Date()
					} : {
						approvedAt: null
					}
				),
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
				tenantId: RequestContext.currentTenantId()
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
		timesheets.forEach((timesheet: ITimesheet) => {
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
