import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimerController } from './timer.controller';
import { TimerResolver } from './timer.resolver';
import { TimerService } from './timer.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [RolePermissionModule, TimeLogModule, EmployeeModule, CqrsModule],
	controllers: [TimerController],
	exports: [TimerService],
	providers: [
		TimerService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TimerResolver,
		...CommandHandlers,
		...QueryHandlers
	]
})
export class TimerModule {}
