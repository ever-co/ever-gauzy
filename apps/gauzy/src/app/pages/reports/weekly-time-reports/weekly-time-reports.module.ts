import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule } from '@nebular/theme';
import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { DailyStatisticsModule } from '../../../@shared/report/daily-statistics/daily-statistics.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [WeeklyTimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		WeeklyTimeReportsRoutingModule,
		LineChartModule,
		DailyStatisticsModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		GauzyFiltersModule,
		NbBadgeModule,
		NoDataMessageModule
	]
})
export class WeeklyTimeReportsModule {}
