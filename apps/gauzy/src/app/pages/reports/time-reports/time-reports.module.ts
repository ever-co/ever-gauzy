import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import {
	DailyGridModule,
	DailyStatisticsModule,
	GauzyFiltersModule,
	LineChartModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { TranslateModule } from '@ngx-translate/core';
import { TimeReportsRoutingModule } from './time-reports-routing.module';
import { TimeReportsComponent } from './time-reports/time-reports.component';

@NgModule({
	declarations: [TimeReportsComponent],
	imports: [
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		DailyGridModule,
		DailyStatisticsModule,
		TimeReportsRoutingModule,
		LineChartModule,
		GauzyFiltersModule
	]
})
export class TimeReportsModule {}
