import { NgModule } from '@angular/core';
import { DailyGridModule, DailyStatisticsModule, GauzyFiltersModule, SharedModule } from '@gauzy/ui-core/shared';
import { TimeActivitiesRoutingModule } from './time-activities-routing.module';
import { TimeActivitiesComponent } from './time-activities/time-activities.component';

@NgModule({
	declarations: [TimeActivitiesComponent],
	imports: [TimeActivitiesRoutingModule, DailyGridModule, DailyStatisticsModule, SharedModule, GauzyFiltersModule]
})
export class TimeAndActivitiesModule {}
