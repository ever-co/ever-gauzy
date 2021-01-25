import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { TimeLog } from '../../../timesheet/time-log.entity';
import { getConfig } from '@gauzy/config';
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
					employeeId
				})
				.getRawOne();
			totalWorkHours = (logs.duration || 0) / 3600;
		}

		await this.employeeService.update(employeeId, {
			totalWorkHours: parseInt(totalWorkHours + '', 10)
		});
	}
}
