import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentReportGridComponent } from './payment-report-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewModule } from "../project-column-view/project-column-view.module";
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';

@NgModule({
	declarations: [PaymentReportGridComponent],
	exports: [PaymentReportGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	],
})
export class PaymentReportGridModule { }
