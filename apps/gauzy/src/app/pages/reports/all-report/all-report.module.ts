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
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [AllReportComponent],
	imports: [
		CommonModule,
		AllReportRoutingModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule
	]
})
export class AllReportModule {}
