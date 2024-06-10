import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentsComponent } from './payments.component';
import { NbCardModule, NbIconModule, NbButtonModule, NbDialogModule, NbSpinnerModule } from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { SharedModule } from '../../@shared/shared.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	OrganizationContactService,
	PaymentService
} from '@gauzy/ui-sdk/core';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';

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
		GauzyButtonActionModule
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService, InvoiceEstimateHistoryService],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
