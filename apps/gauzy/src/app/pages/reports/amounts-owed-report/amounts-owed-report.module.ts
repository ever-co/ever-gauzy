import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmountsOwedReportRoutingModule } from './amounts-owed-report-routing.module';
import { AmountsOwedReportComponent } from './amounts-owed-report/amounts-owed-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { AmountsOwedGridModule } from '../../../@shared/report/amounts-owed-grid/amounts-owed-grid.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { SharedModule } from '../../../@shared/shared.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';

@NgModule({
	declarations: [AmountsOwedReportComponent],
	imports: [
		CommonModule,
		AmountsOwedReportRoutingModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		AmountsOwedGridModule,
		LineChartModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule
	]
})
export class AmountsOwedReportModule {}
