import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository, SelectQueryBuilder, WhereExpression } from 'typeorm';
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

		/**
		 * If organization not found,use employee organization
		 */
		if (!organizationId) {
			const employee = await this.employeeRepository.findOne(employeeId, {
				where: (query: SelectQueryBuilder<Employee>) => {
					query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				}
			});
			organizationId = employee.organizationId;
		}

		/**
		 * Find employee current week working timesheet
		 */
		let timesheet = await this.timeSheetRepository.findOne({
			where: (query: SelectQueryBuilder<Timesheet>) => {
				query.andWhere(
					new Brackets((qb: WhereExpression) => { 
						qb.where(
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
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpression) => { 
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
						qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
						qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
					})
				);
				console.log(query.getQueryAndParameters(), 'Timesheet Query Paramerts');
			}
		});
		if (!timesheet) {
			timesheet = await this.commandBus.execute(
				new TimesheetCreateCommand({
					startedAt: new Date(startedAt.toDate()),
					stoppedAt: new Date(stoppedAt.toDate()),
					employeeId,
					organizationId,
					mouse: 0,
					keyboard: 0,
					duration: 0
				})
			);
		}
		return timesheet;
	}
}
