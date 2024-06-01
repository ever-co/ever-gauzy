import { NgModule } from '@angular/core';
import { PaymentsComponent } from './payments.component';
import { NbCardModule, NbIconModule, NbButtonModule, NbDialogModule, NbSpinnerModule } from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';

@NgModule({
	imports: [
		TranslateModule.forChild(),
		NbCardModule,
		PaymentsRoutingModule,
		Angular2SmartTableModule,
		CardGridModule,
		ThemeModule,
		NbIconModule,
		NbSpinnerModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		PaginationV2Module,
		TableFiltersModule,
		GauzyButtonActionModule
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService, InvoiceEstimateHistoryService],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
