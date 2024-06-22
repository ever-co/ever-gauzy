import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { AmountsOwedGridModule, i4netFiltersModule, LineChartModule, SharedModule } from '@gauzy/ui-core/shared';
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
		i4netFiltersModule
	]
})
export class AmountsOwedReportModule { }
