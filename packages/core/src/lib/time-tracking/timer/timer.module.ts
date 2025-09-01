import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { StatisticModule } from '../statistic/statistic.module';
import { TimerWeeklyLimitService } from './timer-weekly-limit.service';
import { TaskModule } from '../../tasks';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { OrganizationProjectModule } from '../../organization-project/organization-project.module';
import { OrganizationProjectService } from '../../organization-project';
import { RoleModule } from '../../role/role.module';
import { SocketModule } from '../../socket';

@Module({
	imports: [
		RolePermissionModule,
		forwardRef(() => OrganizationProjectModule),
		EmployeeModule,
		RoleModule,
		forwardRef(() => TimeLogModule),
		forwardRef(() => StatisticModule),
		forwardRef(() => TaskModule),
		CqrsModule,
		SocketModule
	],
	controllers: [TimerController],
	exports: [TimerService, TimerWeeklyLimitService],
	providers: [OrganizationProjectService, TimerService, TimerWeeklyLimitService, ...CommandHandlers, ...QueryHandlers]
})
export class TimerModule {}
