import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule,
	NbToggleModule,
	NbButtonModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { AllReportRoutingModule } from './all-report-routing.module';
import { AllReportComponent } from './all-report/all-report.component';

@NgModule({
	declarations: [AllReportComponent],
	imports: [
		AllReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		NbToggleModule,
		NbButtonModule
	]
})
export class AllReportModule {}
