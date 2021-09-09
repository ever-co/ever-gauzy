import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { TenantModule } from './../../tenant/tenant.module';

@Module({
	controllers: [
		TimerController
	],
	imports: [
		TenantModule,
		TimeLogModule,
		EmployeeModule,
		CqrsModule
	],
	providers: [
		TimerService
	],
	exports: [
		TimerService
	]
})
export class TimerModule {}
