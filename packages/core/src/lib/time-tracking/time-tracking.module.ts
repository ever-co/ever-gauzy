import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { ScreenshotModule } from './screenshot/screenshot.module';
import { StatisticModule } from './statistic';
import { TimeLogModule } from './time-log/time-log.module';
import { TimerModule } from './timer/timer.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { TimeSlotModule } from './time-slot/time-slot.module';
@Module({
	controllers: [],
	imports: [
		TimerModule,
		ActivityModule,
		TimeLogModule,
		TimeSlotModule,
		ScreenshotModule,
		StatisticModule,
		TimesheetModule
	]
})
export class TimeTrackingModule {}
