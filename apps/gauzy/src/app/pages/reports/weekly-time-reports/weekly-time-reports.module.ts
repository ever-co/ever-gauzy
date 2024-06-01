import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule } from '@nebular/theme';
import { WeeklyTimeReportsRoutingModule } from './weekly-time-reports-routing.module';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { SharedModule } from '../../../@shared/shared.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { DailyStatisticsModule } from '../../../@shared/report/daily-statistics/daily-statistics.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
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
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule,
		NbBadgeModule,
		NoDataMessageModule
	]
})
export class WeeklyTimeReportsModule {}
