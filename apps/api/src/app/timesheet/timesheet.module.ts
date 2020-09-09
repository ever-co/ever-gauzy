import { Module } from '@nestjs/common';
import { Timesheet } from './timesheet.entity';
import { TimeSlot } from './time-slot.entity';
import { Activity } from './activity.entity';
import { Screenshot } from './screenshot.entity';
import { TimeLog } from './time-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimerController } from './timer/timer.controller';
import { TimerService } from './timer/timer.service';
import { Employee } from '../employee/employee.entity';
import { TimeSlotMinute } from './time-slot-minute.entity';
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
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Task } from '../tasks/task.entity';
import { EmailTemplate } from '../email-template/email-template.entity';
import { Organization } from '../organization/organization.entity';
import { Email } from '../email/email.entity';
import { EmailService } from '../email/email.service';
import { EmailModule } from '../email';
import { TimeSlotCommandHandlers } from './time-slot/commands/handlers';

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
		TypeOrmModule.forFeature([
			TimeSlot,
			Activity,
			Screenshot,
			TimeLog,
			Timesheet,
			Employee,
			TimeSlotMinute,
			OrganizationProjects,
			Task,
			Email,
			EmailTemplate,
			Organization
		]),
		CqrsModule,
		EmailModule
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
		...TimeLogCommandHandlers,
		...TimesheetCommandHandlers,
		...TimeSlotCommandHandlers,
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
