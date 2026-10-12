import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DailyGridModule, DailyStatisticsModule, GauzyFiltersModule, SharedModule } from '@gauzy/ui-core/shared';
import { TimeActivitiesRoutingModule } from './time-activities-routing.module';
import { TimeActivitiesComponent } from './time-activities/time-activities.component';

@NgModule({
	declarations: [TimeActivitiesComponent],
	imports: [
		NbSelectModule,
		TranslateModule.forChild(),
		TimeActivitiesRoutingModule,
		DailyGridModule,
		DailyStatisticsModule,
		SharedModule,
		GauzyFiltersModule
	]
})
export class TimeAndActivitiesModule {}
