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

@Module({
	controllers: [
		TimerController,
		ActivityController,
		TimeLogController,
		TimeSlotController,
		ScreenshotController,
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
			TimeSlotMinute
		]),
		CqrsModule
	],
	providers: [
		TimerService,
		TimeSheetService,
		ActivityService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService,
		...CommandHandlers
	],
	exports: [
		TimeSheetService,
		ActivityService,
		ScreenshotService,
		TimeLogService,
		TimeSlotService
	]
})
export class TimesheetModule {}
