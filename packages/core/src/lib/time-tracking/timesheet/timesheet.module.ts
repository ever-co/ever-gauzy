import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailSendModule } from './../../email-send/email-send.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { EmployeeModule } from './../../employee/employee.module';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { CommandHandlers } from './commands/handlers';
import { TimeSheetController } from './timesheet.controller';
import { TimesheetResolver } from './timesheet.resolver';
import { TimeSheetService } from './timesheet.service';
import { Timesheet } from './timesheet.entity';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { MikroOrmTimesheetRepository } from './repository/mikro-orm-timesheet.repository';

@Module({
	controllers: [TimeSheetController],
	imports: [
		TypeOrmModule.forFeature([Timesheet]),
		MikroOrmModule.forFeature([Timesheet]),
		CqrsModule,
		EmailSendModule,
		RolePermissionModule,
		TimeSlotModule,
		EmployeeModule
	],
	providers: [
		TimeSheetService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TimesheetResolver,
		TypeOrmTimesheetRepository,
		MikroOrmTimesheetRepository,
		...CommandHandlers
	],
	// `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's
	// non-service dependency resolvable: the two writes dispatch through the command bus, and a
	// module's imports are not inherited by the module that imports it — so the module hosting the
	// resolver, which is the GraphQL host, receives the bus only if this module hands it on.
	exports: [TimeSheetService, TypeOrmTimesheetRepository, MikroOrmTimesheetRepository, CqrsModule]
})
export class TimesheetModule {}