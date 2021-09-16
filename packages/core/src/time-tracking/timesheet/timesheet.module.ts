import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { EmailModule } from './../../email/email.module';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { EmployeeModule } from './../../employee/employee.module';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { CommandHandlers } from './commands/handlers';
import { TimeSheetController } from './timesheet.controller';
import { TimeSheetService } from './timesheet.service';
import { Timesheet } from './timesheet.entity';

@Module({
	controllers: [
		TimeSheetController
	],
	imports: [
		TypeOrmModule.forFeature([ Timesheet ]),
		CqrsModule,
		EmailModule,
		TenantModule,
		TimeSlotModule,
		EmployeeModule,
		UserModule
	],
	providers: [
		TimeSheetService,
		...CommandHandlers
	],
	exports: [
		TimeSheetService,
		TypeOrmModule
	]
})
export class TimesheetModule {}
