import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule, NbButtonModule } from '@nebular/theme';
import {
	DailyStatisticsModule,
	GauzyFiltersModule,
	LineChartModule,
	NoDataMessageModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';

@NgModule({
	declarations: [WeeklyTimeReportsComponent],
	imports: [
		SharedModule,
		WeeklyTimeReportsRoutingModule,
		LineChartModule,
		DailyStatisticsModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		GauzyFiltersModule,
		NbBadgeModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class WeeklyTimeReportsModule {}
