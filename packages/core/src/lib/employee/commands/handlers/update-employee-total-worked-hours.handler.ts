import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { RequestContext } from './../../../core/context';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { TypeOrmTimeLogRepository } from '../../../time-tracking/time-log/repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-tracking/time-slot/repository/type-orm-time-slot.repository';

@CommandHandler(UpdateEmployeeTotalWorkedHoursCommand)
export class UpdateEmployeeTotalWorkedHoursHandler implements ICommandHandler<UpdateEmployeeTotalWorkedHoursCommand> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
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

		// Determine total work hours, calculate if not provided
		const totalWorkHours = (await this.calculateTotalWorkHours(employeeId, tenantId)) || hours;
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
		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeLogRepository.createQueryBuilder();
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Get the sum of durations between startedAt and stoppedAt
		const sumQuery = this.getSumQuery(query.alias);
		console.log('sum of durations between startedAt and stoppedAt', sumQuery);

		// Execute the query and get the duration
		const result = await query
			.select(sumQuery, 'duration')
			.where({
				employeeId,
				tenantId
			})
			.getRawOne();

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

		switch (dbConnectionOptions.type) {
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
