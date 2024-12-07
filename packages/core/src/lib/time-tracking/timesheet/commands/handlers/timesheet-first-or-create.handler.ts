import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { Employee, Timesheet } from './../../../../core/entities/internal';
import { RequestContext } from './../../../../core/context';
import { TimesheetFirstOrCreateCommand } from './../timesheet-first-or-create.command';
import { TimesheetCreateCommand } from './../timesheet-create.command';
import { prepareSQLQuery as p } from './../../../../database/database.helper';

@CommandHandler(TimesheetFirstOrCreateCommand)
export class TimesheetFirstOrCreateHandler
	implements ICommandHandler<TimesheetFirstOrCreateCommand> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		private readonly commandBus: CommandBus
	) { }

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
			const employee = await this.employeeRepository.findOneBy({
				id: employeeId,
				tenantId
			});
			organizationId = employee.organizationId;
		}

		try {
			/**
			 * Find employee current week working timesheet
			 */
			const query = this.timeSheetRepository.createQueryBuilder('timesheet');
			query.where((query: SelectQueryBuilder<Timesheet>) => {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.where(
							[
								{
									startedAt: Between(
										startedAt.toDate(),
										stoppedAt.toDate()
									)
								},
								{
									stoppedAt: Between(
										startedAt.toDate(),
										stoppedAt.toDate()
									)
								}
							]
						);
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
						qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
					})
				);
			});
			return await query.getOneOrFail();
		} catch (error) {

			/**
			 * Create employee current week working timesheet
			 */
			return await this.commandBus.execute(
				new TimesheetCreateCommand({
					startedAt: moment(startedAt).toDate(),
					stoppedAt: moment(stoppedAt).toDate(),
					employeeId,
					organizationId,
					mouse: 0,
					keyboard: 0,
					duration: 0
				})
			);
		}
	}
}
