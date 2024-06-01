import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AllReportRoutingModule } from './all-report-routing.module';
import { AllReportComponent } from './all-report/all-report.component';
import { SharedModule } from '../../../@shared/shared.module';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule,
	NbToggleModule,
	NbButtonModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [AllReportComponent],
	imports: [
		CommonModule,
		AllReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		NbToggleModule,
		HeaderTitleModule,
		NbButtonModule
	]
})
export class AllReportModule {}
