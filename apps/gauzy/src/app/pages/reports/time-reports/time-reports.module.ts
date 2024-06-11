import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeReportsRoutingModule } from './time-reports-routing.module';
import { TimeReportsComponent } from './time-reports/time-reports.component';
import { GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { DailyGridModule } from '../../../@shared/report/daily-grid/daily-grid.module';
import { DailyStatisticsModule } from '../../../@shared/report/daily-statistics/daily-statistics.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';

@NgModule({
	declarations: [TimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		DailyGridModule,
		DailyStatisticsModule,
		TimeReportsRoutingModule,
		LineChartModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		GauzyFiltersModule
	]
})
export class TimeReportsModule {}
