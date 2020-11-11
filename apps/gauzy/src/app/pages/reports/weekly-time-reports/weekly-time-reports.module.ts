import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { SharedModule } from '../../../@shared/shared.module';
import { NbIconModule, NbSpinnerModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { WeeklyTimeReportHorizontalBarChartModule } from '../charts/weekly-time-report-horizontal-bar-chart/weekly-time-report-horizontal-bar-chart.module';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';

@NgModule({
	declarations: [WeeklyTimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		WeeklyTimeReportsRoutingModule,
		WeeklyTimeReportHorizontalBarChartModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule
	]
})
export class WeeklyTimeReportsModule {}
