import { NgModule } from '@angular/core';
import { PaymentsComponent } from './payments.component';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';

@NgModule({
	imports: [
		TranslateModule,
		NbCardModule,
		PaymentsRoutingModule,
		Ng2SmartTableModule,
		CardGridModule,
		ThemeModule,
		NbIconModule,
		NbSpinnerModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		PaginationModule,
		TableFiltersModule
	],
	providers: [
		PaymentService,
		OrganizationContactService,
		InvoicesService,
		InvoiceEstimateHistoryService
	],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
