import { Module } from '@nestjs/common';
import { Timesheet } from './timesheet.entity';
import { TimeSlot } from './time-slot.entity';
import { Activity } from './activity.entity';
import { Screenshot } from './screenshot.entity';
import { TimeLog } from './time-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			TimeSlot,
			Activity,
			Screenshot,
			TimeLog,
			Timesheet
		])
	],
	exports: []
})
export class TimesheetModule {}
