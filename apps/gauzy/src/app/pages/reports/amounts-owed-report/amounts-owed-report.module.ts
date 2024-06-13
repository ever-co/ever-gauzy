import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AmountsOwedGridModule, GauzyFiltersModule, LineChartModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { AmountsOwedReportRoutingModule } from './amounts-owed-report-routing.module';
import { AmountsOwedReportComponent } from './amounts-owed-report/amounts-owed-report.component';

@NgModule({
	declarations: [AmountsOwedReportComponent],
	imports: [
		CommonModule,
		AmountsOwedReportRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		AmountsOwedGridModule,
		LineChartModule,
		GauzyFiltersModule
	]
})
export class AmountsOwedReportModule {}
