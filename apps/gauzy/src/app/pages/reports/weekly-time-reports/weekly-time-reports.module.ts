import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { TimeReportHorizontalBarChartModule } from '../time-report-horizontal-bar-chart/time-report-horizontal-bar-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { NbIconModule, NbSpinnerModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [WeeklyTimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		WeeklyTimeReportsRoutingModule,
		TimeReportHorizontalBarChartModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule
	]
})
export class WeeklyTimeReportsModule {}
