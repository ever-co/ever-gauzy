import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { databaseTypes, getConfig } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { EmployeeService } from '../../employee.service';
import { TimeLog } from './../../../core/entities/internal';
import { RequestContext } from 'core';
const config = getConfig();

@CommandHandler(UpdateEmployeeTotalWorkedHoursCommand)
export class UpdateEmployeeTotalWorkedHoursHandler
	implements ICommandHandler<UpdateEmployeeTotalWorkedHoursCommand> {
	constructor(
		private readonly employeeService: EmployeeService,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {}

	public async execute(command: UpdateEmployeeTotalWorkedHoursCommand) {
		const { employeeId, hours } = command;
		const tenantId = RequestContext.currentTenantId();

		let totalWorkHours: number;
		if (hours) {
			totalWorkHours = hours;
		} else {
			let query:string = '';
			switch(config.dbConnectionOptions.type) {
				case databaseTypes.sqlite:
				case databaseTypes.betterSqlite3:
					query = 'SUM((julianday("stoppedAt") - julianday("startedAt")) * 86400)';
					break;
				case databaseTypes.postgres:
					query = 'SUM(extract(epoch from ("stoppedAt" - "startedAt")))';
					break;
				case databaseTypes.mysql:
					query = p('SUM(TIMESTAMPDIFF(SECOND, "startedAt", "stoppedAt"))');
					break;
				default:
					throw Error(`cannot update employee total worked hours due to unsupported database type: ${config.dbConnectionOptions.type}`);

			}
			const logs = await this.timeLogRepository
				.createQueryBuilder()
				.select(
					query,
					`duration`
				)
				.where({
					employeeId,
					tenantId
				})
				.getRawOne();
			totalWorkHours = (logs.duration || 0) / 3600;
		}

		await this.employeeService.update(employeeId, {
			totalWorkHours: parseInt(totalWorkHours + '', 10)
		});
	}
}
