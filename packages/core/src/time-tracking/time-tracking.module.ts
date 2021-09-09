import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { ActivityModule } from './activity/activity.module';
import { ScreenshotModule } from './screenshot/screenshot.module';
import { StatisticModule } from './statistic/statistic.module';
import { TimeLogModule } from './time-log/time-log.module';
import { TimeSlotModule } from './time-slot/time-slot.module';
import { TimerModule } from './timer/timer.module';
import { TimesheetModule } from './timesheet/timesheet.module';

@Module({
	controllers: [],
	imports: [
		RouterModule.forRoutes([
            {
				path: '/timesheet', module: TimeTrackingModule,
				children: [
					{ path: '/timer', module: TimerModule },
                    { path: '/activity', module: ActivityModule },
					{ path: '/time-log', module: TimeLogModule },
                    { path: '/time-slot', module: TimeSlotModule },
					{ path: '/screenshot', module: ScreenshotModule },
					{ path: '/statistics', module: StatisticModule },
					{ path: '/', module: TimesheetModule }
				]
			}
		]),
        TimerModule,
        ActivityModule,
        TimeLogModule,
        TimeSlotModule,
        ScreenshotModule,
        StatisticModule,
        TimesheetModule
	],
	providers: [],
	exports: []
})
export class TimeTrackingModule {}
