import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import {
	DailyGridModule,
	DailyStatisticsModule,
	GauzyFiltersModule,
	LineChartModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeReportsRoutingModule } from './time-reports-routing.module';
import { TimeReportsComponent } from './time-reports/time-reports.component';

@NgModule({
	declarations: [TimeReportsComponent],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslatePipe,
		SharedModule,
		DailyGridModule,
		DailyStatisticsModule,
		TimeReportsRoutingModule,
		LineChartModule,
		GauzyFiltersModule
	]
})
export class TimeReportsModule {}
