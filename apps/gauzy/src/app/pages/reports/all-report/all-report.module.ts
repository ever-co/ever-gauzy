import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AllReportRoutingModule } from './all-report-routing.module';
import { AllReportComponent } from './all-report/all-report.component';
import { SharedModule } from '@gauzy/ui-core/shared';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule,
	NbToggleModule,
	NbButtonModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';

@NgModule({
	declarations: [AllReportComponent],
	imports: [
		CommonModule,
		AllReportRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		NbToggleModule,
		NbButtonModule
	]
})
export class AllReportModule {}
