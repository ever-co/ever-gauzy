import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { ScreenshotModule } from './screenshot/screenshot.module';
import { StatisticModule } from './statistic';
import { TimeLogModule } from './time-log/time-log.module';
import { TimerModule } from './timer/timer.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { TimeSlotModule } from './time-slot/time-slot.module';
import { CqrsModule } from '@nestjs/cqrs';
import { StartTimerHandler } from './timer/commands/handlers/start-timer.handler';
import { StopTimerHandler } from './timer/commands/handlers/stop-timer.handler';

@Module({
	controllers: [],
	imports: [
		TimerModule,
		ActivityModule,
		TimeLogModule,
		TimeSlotModule,
		ScreenshotModule,
		StatisticModule,
		TimesheetModule,
		CqrsModule
	],
	providers: [StartTimerHandler, StopTimerHandler]
})
export class TimeTrackingModule {}
