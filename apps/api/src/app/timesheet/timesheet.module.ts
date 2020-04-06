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
import { TimeLogController } from './time-log/time-log.controller';
import {
	ActivityService,
	ScreenShotService,
	TimeLogService,
	TimeSlotService,
	TimeSheetService
} from '.';

@Module({
	controllers: [TimerController, TimeLogController],
	imports: [
		TypeOrmModule.forFeature([
			TimeSlot,
			Activity,
			Screenshot,
			TimeLog,
			Timesheet,
			Employee
		])
	],
	providers: [
		TimerService,
		TimeSheetService,
		ActivityService,
		ScreenShotService,
		TimeLogService,
		TimeSlotService
	],
	exports: [
		TimeSheetService,
		ActivityService,
		ScreenShotService,
		TimeLogService,
		TimeSlotService
	]
})
export class TimesheetModule {}
