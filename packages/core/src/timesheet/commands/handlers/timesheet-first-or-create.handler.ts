import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { Employee, Timesheet } from './../../../core/entities/internal';
import { RequestContext } from './../../../core/context';
import { TimesheetFirstOrCreateCommand } from './../timesheet-first-or-create.command';
import { TimesheetCreateCommand } from './../timesheet-create.command';

@CommandHandler(TimesheetFirstOrCreateCommand)
export class TimesheetFirstOrCreateHandler
	implements ICommandHandler<TimesheetFirstOrCreateCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: TimesheetFirstOrCreateCommand
	): Promise<ITimesheet> {
		const { date, employeeId } = command;
		let { organizationId } = command;
		const tenantId = RequestContext.currentTenantId();

		const startedAt = moment.utc(date).startOf('week');
		const stoppedAt = moment.utc(date).endOf('week');

		if (!organizationId) {
			const employee = await this.employeeRepository.findOne(employeeId, {
				where: (query: SelectQueryBuilder<Employee>) => {
					query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				}
			});
			organizationId = employee.organizationId;
		}

		let timesheet = await this.timeSheetRepository.findOne({
			where: (query: SelectQueryBuilder<Timesheet>) => {
				query.where(
					[
						{
							startedAt: Between(
								startedAt.format('YYYY-MM-DD HH:mm:ss.SSS'),
								stoppedAt.format('YYYY-MM-DD HH:mm:ss.SSS')
							)
						}, 
						{
							stoppedAt: Between(
								startedAt.format('YYYY-MM-DD HH:mm:ss.SSS'),
								stoppedAt.format('YYYY-MM-DD HH:mm:ss.SSS')
							)
						}
					]
				);
				query.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
				query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

				console.log(query.getQueryAndParameters(), 'Timesheet Query Paramerts');
			}
		});
		if (!timesheet) {
			timesheet = await this.commandBus.execute(
				new TimesheetCreateCommand({
					startedAt: startedAt.toISOString(),
					stoppedAt: stoppedAt.toISOString(),
					employeeId,
					organizationId,
					tenantId,
					mouse: 0,
					keyboard: 0,
					duration: 0
				})
			);
		}
		return timesheet;
	}
}
