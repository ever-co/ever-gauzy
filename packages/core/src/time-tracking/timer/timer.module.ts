import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';

@Module({
	controllers: [
		TimerController
	],
	imports: [
		TenantModule,
		TimeLogModule,
		EmployeeModule,
		UserModule,
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
