import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getConfig } from '@gauzy/config';
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
			const logs = await this.timeLogRepository
				.createQueryBuilder()
				.select(
					`${
						config.dbConnectionOptions.type === 'sqlite'
							? 'SUM((julianday("stoppedAt") - julianday("startedAt")) * 86400)'
							: 'SUM(extract(epoch from ("stoppedAt" - "startedAt")))'
					}`,
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
