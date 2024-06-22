import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentsComponent } from './payments.component';
import { NbCardModule, NbIconModule, NbButtonModule, NbDialogModule, NbSpinnerModule } from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import {
	CardGridModule,
	i4netButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TableFiltersModule
} from '@gauzy/ui-core/shared';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	OrganizationContactService,
	PaymentService
} from '@gauzy/ui-core/core';

@NgModule({
	imports: [
		CommonModule,
		I18nTranslateModule.forChild(),
		NbCardModule,
		PaymentsRoutingModule,
		Angular2SmartTableModule,
		CardGridModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		PaginationV2Module,
		TableFiltersModule,
		i4netButtonActionModule
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService, InvoiceEstimateHistoryService],
	declarations: [PaymentsComponent]
})
export class PaymentsModule { }
