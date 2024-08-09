import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { PaymentReportGridComponent } from './payment-report-grid.component';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout';

@NgModule({
	declarations: [PaymentReportGridComponent],
	exports: [PaymentReportGridComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		ProjectColumnViewModule,
		SmartDataViewLayoutModule
	]
})
export class PaymentReportGridModule {}
