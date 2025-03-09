import { Module } from '@nestjs/common';
import { CqrsModule, QueryHandler } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [RolePermissionModule, TimeLogModule, EmployeeModule, CqrsModule],
	controllers: [TimerController],
	exports: [TimerService],
	providers: [TimerService, ...CommandHandlers, ...QueryHandlers]
})
export class TimerModule {}
