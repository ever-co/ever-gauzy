import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimeAndActivitiesRoutingModule } from './time-and-activities-routing.module';
import { TimeAndActivitiesComponent } from './time-and-activities/time-and-activities.component';
import { DailyGridModule } from 'apps/gauzy/src/app/@shared/report/daily-grid/daily-grid.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import { DailyStatisticsModule } from 'apps/gauzy/src/app/@shared/report/daily-statistics/daily-statistics.module';

@NgModule({
	declarations: [TimeAndActivitiesComponent],
	imports: [
		CommonModule,
		TimeAndActivitiesRoutingModule,
		DailyGridModule,
		DailyStatisticsModule,
		SharedModule,
		FiltersModule
	]
})
export class TimeAndActivitiesModule {}
