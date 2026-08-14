import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { RequestContext } from './../../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from './../../../../core/utils';
import { EmployeeService } from '../../../../employee/employee.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from '../../repository/mikro-orm-time-log.repository';

@CommandHandler(UpdateEmployeeTotalWorkedHoursCommand)
export class UpdateEmployeeTotalWorkedHoursHandler implements ICommandHandler<UpdateEmployeeTotalWorkedHoursCommand> {
	protected ormType: MultiORM = getORMType();

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _configService: ConfigService
	) {}

	/**
	 * Updates the total worked hours for an employee.
	 *
	 * @param command The command containing employee ID and worked hours.
	 */
	public async execute(command: UpdateEmployeeTotalWorkedHoursCommand) {
		const { employeeId, hours } = command;
		const tenantId = RequestContext.currentTenantId();

		// Determine total work hours, falling back to the provided value only when it could not be calculated.
		// A calculated total of 0 is a legitimate result (an employee with no time logs yet); `||` discarded it
		// and fell through to the optional `hours`, which no caller passes. `Math.floor(undefined)` is NaN, and
		// TypeORM writes NaN into the statement as a bare SQL literal that drivers reject
		// ("no such column: NaN" on SQLite), failing the whole enclosing request — creating a
		// manual time log, among others.
		const calculated = await this.calculateTotalWorkHours(employeeId, tenantId);
		const totalWorkHours = Number.isFinite(calculated) ? calculated : hours;

		// Nothing meaningful to store
		if (!Number.isFinite(totalWorkHours)) {
			return;
		}

		console.log('Updated Employee Total Worked Hours: %s', Math.floor(totalWorkHours));

		// Update employee's total worked hours
		await this._employeeService.update(employeeId, {
			totalWorkHours: Math.floor(totalWorkHours) // Use Math.floor for integer conversion
		});
	}

	/**
	 * Calculates the total work hours for an employee.
	 * @param employeeId The ID of the employee.
	 * @param tenantId The tenant ID.
	 * @returns The total work hours.
	 */
	private async calculateTotalWorkHours(employeeId: ID, tenantId: ID): Promise<number> {
		let result: any;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmTimeLogRepository.getKnex();
				const sumQuery = this.getSumQuery('time_log');

				result = await knex('time_log')
					.withSchema(knex.userParams.schema)
					.innerJoin('time_slot_time_logs', 'time_slot_time_logs.timeLogId', 'time_log.id')
					.innerJoin('time_slot', 'time_slot.id', 'time_slot_time_logs.timeSlotId')
					.select(knex.raw(`${sumQuery} as duration`))
					.where({ 'time_log.employeeId': employeeId, 'time_log.tenantId': tenantId })
					.first();
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmTimeLogRepository.createQueryBuilder();
				query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

				// Get the sum of durations between startedAt and stoppedAt
				const sumQuery = this.getSumQuery(query.alias);
				console.log('sum of durations between startedAt and stoppedAt', sumQuery);

				// Execute the query and get the duration
				result = await query
					.select(sumQuery, 'duration')
					.where({
						employeeId,
						tenantId
					})
					.getRawOne();
				break;
			}
		}

		console.log(`get sum duration for specific employee: ${employeeId}`, +result.duration);

		// Convert duration from seconds to hours
		return Number(+result.duration || 0) / 3600;
	}

	/**
	 * Get the database-specific sum query for calculating time duration between "startedAt" and "stoppedAt".
	 * @param logQueryAlias The alias for the table in the query.
	 * @returns The database-specific sum query that returns a Number.
	 */
	private getSumQuery(logQueryAlias: string): string {
		let sumQuery: string;

		const { dbConnectionOptions } = this._configService;

		switch (dbConnectionOptions.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				sumQuery = `
					CAST(
						SUM(
							CASE
								WHEN (julianday("${logQueryAlias}"."stoppedAt") - julianday("${logQueryAlias}"."startedAt")) * 86400 >= 0
								THEN (julianday("${logQueryAlias}"."stoppedAt") - julianday("${logQueryAlias}"."startedAt")) * 86400
								ELSE 0
							END
						) AS REAL
					)
				`;
				break;
			case DatabaseTypeEnum.postgres:
				sumQuery = `
					CAST(
						SUM(
							CASE
								WHEN extract(epoch from ("${logQueryAlias}"."stoppedAt" - "${logQueryAlias}"."startedAt")) >= 0
								THEN extract(epoch from ("${logQueryAlias}"."stoppedAt" - "${logQueryAlias}"."startedAt"))
								ELSE 0
							END
						) AS DOUBLE PRECISION
					)
				`;
				break;
			case DatabaseTypeEnum.mysql:
				sumQuery = p(`
					CAST(
						SUM(
							CASE
								WHEN TIMESTAMPDIFF(SECOND, \`${logQueryAlias}\`.\`startedAt\`, \`${logQueryAlias}\`.\`stoppedAt\`) >= 0
								THEN TIMESTAMPDIFF(SECOND, \`${logQueryAlias}\`.\`startedAt\`, \`${logQueryAlias}\`.\`stoppedAt\`)
								ELSE 0
							END
						) AS DECIMAL(10, 6)
					)
				`);
				break;
			default:
				throw new Error(`Unsupported database type: ${dbConnectionOptions.type}`);
		}

		return sumQuery;
	}
}
