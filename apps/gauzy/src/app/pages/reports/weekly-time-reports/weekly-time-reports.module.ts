import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { SharedModule } from '../../../@shared/shared.module';
import { NbIconModule, NbSpinnerModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { DailyStatisticsModule } from '../../../@shared/report/daily-statistics/daily-statistics.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [WeeklyTimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		WeeklyTimeReportsRoutingModule,
		LineChartModule,
		DailyStatisticsModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		HeaderTitleModule
	]
})
export class WeeklyTimeReportsModule {}
