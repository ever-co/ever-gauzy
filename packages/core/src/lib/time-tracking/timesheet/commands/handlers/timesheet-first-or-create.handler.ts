import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Between, Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { RequestContext } from './../../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from './../../../../core/utils';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimesheetFirstOrCreateCommand } from './../timesheet-first-or-create.command';
import { TimesheetCreateCommand } from './../timesheet-create.command';
import { TypeOrmTimesheetRepository } from '../../repository/type-orm-timesheet.repository';
import { MikroOrmTimesheetRepository } from '../../repository/mikro-orm-timesheet.repository';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository/type-orm-employee.repository';
import { Timesheet } from './../../timesheet.entity';

@CommandHandler(TimesheetFirstOrCreateCommand)
export class TimesheetFirstOrCreateHandler implements ICommandHandler<TimesheetFirstOrCreateCommand> {
	protected ormType: MultiORM = getORMType();

	constructor(
		private readonly timeSheetRepository: TypeOrmTimesheetRepository,
		private readonly mikroOrmTimesheetRepository: MikroOrmTimesheetRepository,
		private readonly employeeRepository: TypeOrmEmployeeRepository,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: TimesheetFirstOrCreateCommand): Promise<ITimesheet> {
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
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const knex = this.mikroOrmTimesheetRepository.getKnex();
					const record = await knex('timesheet')
						.withSchema(knex.userParams.schema)
						.where(function () {
							this.where(function () {
								this.where('startedAt', '>=', startedAt.toDate())
									.andWhere('startedAt', '<=', stoppedAt.toDate());
							}).orWhere(function () {
								this.where('stoppedAt', '>=', startedAt.toDate())
									.andWhere('stoppedAt', '<=', stoppedAt.toDate());
							});
						})
						.andWhere({ tenantId, organizationId, employeeId })
						.first();

					if (!record) {
						throw new Error('No timesheet found');
					}
					return record;
				}
				case MultiORMEnum.TypeORM:
				default: {
					/**
					 * Find employee current week working timesheet
					 */
					const query = this.timeSheetRepository.createQueryBuilder('timesheet');
					query.where((query: SelectQueryBuilder<Timesheet>) => {
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								qb.where([
									{
										startedAt: Between(startedAt.toDate(), stoppedAt.toDate())
									},
									{
										stoppedAt: Between(startedAt.toDate(), stoppedAt.toDate())
									}
								]);
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
				}
			}
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
