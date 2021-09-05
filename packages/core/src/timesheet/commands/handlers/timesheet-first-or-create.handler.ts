import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { Employee, Timesheet } from './../../../core/entities/internal';
import { RequestContext } from './../../../core/context';
import { TimesheetFirstOrCreateCommand } from '../timesheet-first-or-create.command';

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
	): Promise<ITimesheet> {
		const { date, employeeId } = command;
		const tenantId = RequestContext.currentTenantId();
		let { organizationId } = command;

		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timeSheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		if (!organizationId) {
			const employee = await this.employeeRepository.findOne({
				where: {
					id: employeeId,
					tenantId
				}
			});
			organizationId = employee.organizationId;
		}

		if (!timesheet) {
			timesheet = await this.timeSheetRepository.save({
				tenantId,
				employeeId,
				organizationId,
				startedAt: from_date.toISOString(),
				stoppedAt: to_date.toISOString()
			});
		}
		return timesheet;
	}
}
