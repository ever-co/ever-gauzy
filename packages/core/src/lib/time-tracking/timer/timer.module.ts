import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { StatisticModule } from '../statistic/statistic.module';
import { TimerWeeklyLimitService } from './timer-weekly-limit.service';
@Module({
	imports: [
		RolePermissionModule,
		EmployeeModule,
		forwardRef(() => TimeLogModule),
		forwardRef(() => StatisticModule),
		CqrsModule
	],
	controllers: [TimerController],
	exports: [TimerService, TimerWeeklyLimitService],
	providers: [TimerService, TimerWeeklyLimitService]
})
export class TimerModule {}
