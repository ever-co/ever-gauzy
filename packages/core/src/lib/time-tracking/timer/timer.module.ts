import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { StartTimerHandler, StopTimerHandler, GetTimerStatusHandler } from './commands/handlers';
import { MakeComIntegrationModule } from '@gauzy/plugin-integration-make-com';

@Module({
	imports: [RolePermissionModule, TimeLogModule, EmployeeModule, CqrsModule, MakeComIntegrationModule],
	controllers: [TimerController],
	exports: [TimerService],
	providers: [TimerService, StartTimerHandler, StopTimerHandler, GetTimerStatusHandler]
})
export class TimerModule {}
