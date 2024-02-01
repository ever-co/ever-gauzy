import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DatabaseTypeEnum, getConfig } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { EmployeeService } from '../../employee.service';
import { TimeLog } from './../../../core/entities/internal';
import { RequestContext } from './../../../core/context';
import { TypeOrmTimeLogRepository } from '../../../time-tracking/time-log/repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from '../../../time-tracking/time-log/repository/mikro-orm-time-log.repository';

const config = getConfig();

@CommandHandler(UpdateEmployeeTotalWorkedHoursCommand)
export class UpdateEmployeeTotalWorkedHoursHandler implements ICommandHandler<UpdateEmployeeTotalWorkedHoursCommand> {
	constructor(
		private readonly employeeService: EmployeeService,

		@InjectRepository(TimeLog)
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,

		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
	) { }

	/**
	 *
	 * @param command
	 */
	public async execute(command: UpdateEmployeeTotalWorkedHoursCommand) {
		const { employeeId, hours } = command;
		const tenantId = RequestContext.currentTenantId();

		let totalWorkHours: number;
		if (hours) {
			totalWorkHours = hours;
		} else {
			let sumQuery: string = this.getSumQuery();
			const query = this.typeOrmTimeLogRepository.createQueryBuilder();
			query.select(sumQuery, `duration`);
			query.where({ employeeId, tenantId });
			const logs = await query.getRawOne();
			totalWorkHours = (logs.duration || 0) / 3600;
		}

		await this.employeeService.update(employeeId, {
			totalWorkHours: parseInt(totalWorkHours + '', 10)
		});
	}

	/**
	 * Get the database-specific sum query for calculating time duration between "startedAt" and "stoppedAt".
	 * @returns The database-specific sum query.
	 */
	private getSumQuery(): string {
		let sumQuery: string;

		switch (config.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				sumQuery = 'SUM((julianday("stoppedAt") - julianday("startedAt")) * 86400)';
				break;
			case DatabaseTypeEnum.postgres:
				sumQuery = 'SUM(extract(epoch from ("stoppedAt" - "startedAt")))';
				break;
			case DatabaseTypeEnum.mysql:
				sumQuery = p('SUM(TIMESTAMPDIFF(SECOND, "startedAt", "stoppedAt"))');
				break;
			default:
				throw Error(`cannot update employee total worked hours due to unsupported database type: ${config.dbConnectionOptions.type}`);
		}

		return sumQuery;
	}
}
