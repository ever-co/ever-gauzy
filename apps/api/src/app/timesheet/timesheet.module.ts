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
import { TimesheetService } from './timesheet.service';
import { TimeLogService } from './time-log/time-log.service';
import { TimeLogController } from './time-log/time-log.controller';

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
	providers: [TimerService, TimesheetService, TimeLogService],
	exports: []
})
export class TimesheetModule {}
