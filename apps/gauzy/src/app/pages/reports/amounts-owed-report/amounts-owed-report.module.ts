import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AmountsOwedGridModule, GauzyFiltersModule, LineChartModule, SharedModule } from '@gauzy/ui-core/shared';
import { AmountsOwedReportRoutingModule } from './amounts-owed-report-routing.module';
import { AmountsOwedReportComponent } from './amounts-owed-report/amounts-owed-report.component';

@NgModule({
	declarations: [AmountsOwedReportComponent],
	imports: [
		AmountsOwedReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		AmountsOwedGridModule,
		LineChartModule,
		GauzyFiltersModule
	]
})
export class AmountsOwedReportModule {}
