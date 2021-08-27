import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TimerController } from './timer/timer.controller';
import { TimerService } from './timer/timer.service';
import { TimeSheetService } from './timesheet/timesheet.service';
import { ScreenshotService } from './screenshot/screenshot.service';
import { TimeSlotService } from './time-slot/time-slot.service';
import { TimeLogController } from './time-log/time-log.controller';
import { TimeLogService } from './time-log/time-log.service';
import { CommandHandlers } from './commands/handlers';
import { TimeSheetController } from './timesheet/timesheet.controller';
import { TimeSlotController } from './time-slot/time-slot.controller';
import { ScreenshotController } from './screenshot/screenshot.controller';
import { TimesheetCommandHandlers } from './timesheet/commands/handlers';
import { TimeLogCommandHandlers } from './time-log/commands/handlers';
import { StatisticService } from './statistic/statistic.service';
import { StatisticController } from './statistic/statistic.controller';
import { EmailService } from '../email/email.service';
import { EmailModule } from '../email';
import { TimeSlotCommandHandlers } from './time-slot/commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import {
	Activity,
	Email,
	EmailTemplate,
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProject,
	Screenshot,
	Task,
	TimeLog,
	Timesheet,
	TimeSlot,
	TimeSlotMinute
} from './../core/entities/internal';
import { ActivityModule } from './activity/activity.module';

@Module({
	controllers: [
		TimerController,
		TimeLogController,
		TimeSlotController,
		ScreenshotController,
		StatisticController,
		TimeSheetController
	],
	imports: [
		RouterModule.forRoutes([
			{
				path: '/timesheet', module: TimesheetModule,
				children: [
					{ path: '/activity', module: ActivityModule }
				]
			}
		]),
		TypeOrmModule.forFeature([
			TimeSlot,
			Screenshot,
			TimeLog,
			Timesheet,
			Employee,
			TimeSlotMinute,
			OrganizationProject,
			Task,
			Email,
			EmailTemplate,
			Organization,
			OrganizationContact
		]),
		CqrsModule,
		EmailModule,
		TenantModule,
		ActivityModule
	],
	providers: [
		TimerService,
		TimeSheetService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService,
		StatisticService,
		EmailService,
		...TimeLogCommandHandlers,
		...TimesheetCommandHandlers,
		...TimeSlotCommandHandlers,
		...CommandHandlers
	],
	exports: [
		TimeSheetService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService,
		StatisticService,
		ActivityModule
	]
})
export class TimesheetModule {}
