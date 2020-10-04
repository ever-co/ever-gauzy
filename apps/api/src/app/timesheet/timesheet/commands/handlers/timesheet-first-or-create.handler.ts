import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TimesheetFirstOrCreateCommand } from '../timesheet-first-or-create.command';
import { Timesheet } from '../../../timesheet.entity';
import * as moment from 'moment';
import { RequestContext } from 'apps/api/src/app/core/context';
import { Employee } from 'apps/api/src/app/employee/employee.entity';

@CommandHandler(TimesheetFirstOrCreateCommand)
export class TimesheetFirstOrCreateHandler
	implements ICommandHandler<TimesheetFirstOrCreateCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(
		command: TimesheetFirstOrCreateCommand
	): Promise<Timesheet> {
		const { date, employeeId } = command;

		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timeSheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		let organizationId: string;
		if (!command.organizationId) {
			const employee = await this.employeeRepository.findOne(employeeId);
			organizationId = employee.organizationId;
		}

		if (!timesheet) {
			timesheet = await this.timeSheetRepository.save({
				tenantId: RequestContext.currentTenantId(),
				employeeId: employeeId,
				organizationId,
				startedAt: from_date.toISOString(),
				stoppedAt: to_date.toISOString()
			});
		}
		return timesheet;
	}
}
