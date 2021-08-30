import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { EmailService } from '../email/email.service';
import { EmailModule } from '../email';
import { Email, EmailTemplate } from './../core/entities/internal';
import { TenantModule } from '../tenant/tenant.module';
import { EmployeeModule } from './../employee/employee.module';
import { ActivityModule } from './activity/activity.module';
import { TimeSlotModule } from './time-slot/time-slot.module';
import { TimeLogModule } from './time-log/time-log.module';
import { ScreenshotModule } from './screenshot/screenshot.module';
import { StatisticModule } from './statistic/statistic.module';
import { TimerModule } from './timer/timer.module';

import { TimeSheetController } from './timesheet.controller';
import { TimeSheetService } from './timesheet.service';
import { Timesheet } from './timesheet.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	controllers: [
		TimeSheetController
	],
	imports: [
		RouterModule.forRoutes([
			{
				path: '/timesheet', module: TimesheetModule,
				children: [
					{ path: '/activity', module: ActivityModule },
					{ path: '/time-slot', module: TimeSlotModule },
					{ path: '/time-log', module: TimeLogModule },
					{ path: '/screenshot', module: ScreenshotModule },
					{ path: '/statistics', module: StatisticModule },
					{ path: '/timer', module: TimerModule }
				]
			}
		]),
		TypeOrmModule.forFeature([
			Timesheet,
			Email,
			EmailTemplate
		]),
		CqrsModule,
		EmailModule,
		TenantModule,
		ActivityModule,
		TimeSlotModule,
		TimeLogModule,
		ScreenshotModule,
		EmployeeModule
	],
	providers: [
		TimeSheetService,
		EmailService,
		...CommandHandlers
	],
	exports: [
		TimeSheetService
	]
})
export class TimesheetModule {}
