import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule, NbDialogModule, NbSpinnerModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	OrganizationContactService,
	PaymentService
} from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule, CardGridModule, SharedModule, TableFiltersModule } from '@gauzy/ui-core/shared';
import { PaymentsComponent } from './payments.component';
import { PaymentsRoutingModule } from './payments-routing.module';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule.forChild(),
		NbCardModule,
		PaymentsRoutingModule,
		CardGridModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TableFiltersModule
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService, InvoiceEstimateHistoryService],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
