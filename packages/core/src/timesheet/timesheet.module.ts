import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimerController } from './timer/timer.controller';
import { TimerService } from './timer/timer.service';
import { TimeSheetService } from './timesheet/timesheet.service';
import { ActivityService } from './activity/activity.service';
import { ScreenshotService } from './screenshot/screenshot.service';
import { TimeSlotService } from './time-slot/time-slot.service';
import { TimeLogController } from './time-log/time-log.controller';
import { TimeLogService } from './time-log/time-log.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { TimeSheetController } from './timesheet/timesheet.controller';
import { TimeSlotController } from './time-slot/time-slot.controller';
import { ScreenshotController } from './screenshot/screenshot.controller';
import { ActivityController } from './activity/activity.controller';
import { TimesheetCommandHandlers } from './timesheet/commands/handlers';
import { TimeLogCommandHandlers } from './time-log/commands/handlers';
import { StatisticService } from './statistic/statistic.service';
import { StatisticController } from './statistic/statistic.controller';
import { EmailService } from '../email/email.service';
import { EmailModule } from '../email';
import { TimeSlotCommandHandlers } from './time-slot/commands/handlers';
import { ActivityCommandHandlers } from './activity/commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { ActivityMapService } from './activity/activity.map.service';
import { RouterModule } from 'nest-router';
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

@Module({
	controllers: [
		TimerController,
		ActivityController,
		TimeLogController,
		TimeSlotController,
		ScreenshotController,
		StatisticController,
		TimeSheetController
	],
	imports: [
		RouterModule.forRoutes([
			{ path: '/timesheet', module: TimesheetModule }
		]),
		TypeOrmModule.forFeature([
			TimeSlot,
			Activity,
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
		TenantModule
	],
	providers: [
		TimerService,
		TimeSheetService,
		ActivityService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService,
		StatisticService,
		EmailService,
		ActivityMapService,
		...TimeLogCommandHandlers,
		...TimesheetCommandHandlers,
		...TimeSlotCommandHandlers,
		...ActivityCommandHandlers,
		...CommandHandlers
	],
	exports: [
		TimeSheetService,
		ActivityService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService,
		StatisticService
	]
})
export class TimesheetModule {}
