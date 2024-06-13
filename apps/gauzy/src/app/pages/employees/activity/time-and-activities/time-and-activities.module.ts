import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyGridModule, DailyStatisticsModule, GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { TimeAndActivitiesRoutingModule } from './time-and-activities-routing.module';
import { TimeAndActivitiesComponent } from './time-and-activities/time-and-activities.component';

@NgModule({
	declarations: [TimeAndActivitiesComponent],
	imports: [
		CommonModule,
		TimeAndActivitiesRoutingModule,
		DailyGridModule,
		DailyStatisticsModule,
		SharedModule,
		GauzyFiltersModule
	]
})
export class TimeAndActivitiesModule {}
