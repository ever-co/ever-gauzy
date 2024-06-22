import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyGridModule, DailyStatisticsModule, i4netFiltersModule, SharedModule } from '@gauzy/ui-core/shared';
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
		i4netFiltersModule
	]
})
export class TimeAndActivitiesModule { }
