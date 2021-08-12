import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbTooltipModule,
	NbDatepickerModule,
	NbRadioModule,
	NbSpinnerModule,
	NbToggleModule,
	NbContextMenuModule,
	NbMenuModule,
	NbPopoverModule,
	NbTabsetModule,
	NbFormFieldModule,
	NbListModule
} from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoicesComponent } from './invoices.component';
import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { InvoicesReceivedComponent } from './invoices-received/invoices-received.component';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { BackNavigationModule } from '../../@shared/back-navigation';
import { NgxPermissionsModule } from 'ngx-permissions';
import { InvoicePdfComponent } from './invoice-pdf/invoice-pdf.component';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';
import { CurrencyModule } from '../../@shared/currency/currency.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { PublicLinkComponent } from './public-link/public-link.component';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { 
	InvoiceApplyTaxDiscountComponent,
	InvoiceEmployeesSelectorComponent,
	InvoiceEstimateTotalValueComponent,
	InvoiceExpensesSelectorComponent,
	InvoicePaidComponent,
	InvoiceProductsSelectorComponent,
	InvoiceProjectsSelectorComponent,
	InvoiceTasksSelectorComponent 
} from './table-components';
import { 
	EmployeesService,
	InvoiceEstimateHistoryService,
	InvoiceItemService,
	InvoicesService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationsService,
	PaymentService,
	ProductService,
	TasksService,
	TasksStoreService,
	TranslatableService
} from '../../@core/services';
import { 
	EstimateAddComponent,
	EstimateEditComponent,
	EstimatesComponent,
	EstimatesReceivedComponent,
	EstimateViewComponent
} from './invoice-estimates';
import { InvoicePaymentReceiptMutationComponent, InvoicePaymentsComponent, PaymentMutationComponent } from './invoice-payments';
import { InvoiceViewComponent, InvoiceViewInnerComponent } from './invoice-view';
import { SharedModule } from '../../@shared/shared.module';
import { ContactSelectModule } from '../../@shared/contact-select/contact-select.module';

@NgModule({
	imports: [
		TableComponentsModule,
		TagsColorInputModule,
		InvoicesRoutingModule,
		NbCardModule,
		NbSpinnerModule,
		NbIconModule,
		NbButtonModule,
		Ng2SmartTableModule,
		CardGridModule,
		FormsModule,
		NbBadgeModule,
		ReactiveFormsModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		ThemeModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbTooltipModule,
		NbRadioModule,
		EmployeeMultiSelectModule,
		UserFormsModule,
		NbDatepickerModule,
		NgSelectModule,
		NbToggleModule,
		NbContextMenuModule,
		NbMenuModule,
		NbTabsetModule,
		BackNavigationModule,
		NbPopoverModule,
		NbFormFieldModule,
		NbListModule,
		TranslateModule,
		NgxPermissionsModule.forChild(),
		CurrencyModule,
		HeaderTitleModule,
		PaginationModule,
		ContactSelectModule,
		SharedModule
	],
	providers: [
		InvoicesService,
		OrganizationsService,
		InvoiceItemService,
		TasksService,
		OrganizationContactService,
		OrganizationProjectsService,
		EmployeesService,
		ProductService,
		PaymentService,
		TasksStoreService,
		InvoiceEstimateHistoryService,
		TranslatableService
	],
	declarations: [
		InvoicesComponent,
		InvoiceAddComponent,
		InvoiceTasksSelectorComponent,
		InvoiceProjectsSelectorComponent,
		InvoiceEmployeesSelectorComponent,
		InvoiceEditComponent,
		InvoicesReceivedComponent,
		InvoiceSendMutationComponent,
		InvoiceViewComponent,
		InvoiceProductsSelectorComponent,
		InvoicePaidComponent,
		InvoiceEmailMutationComponent,
		InvoiceViewInnerComponent,
		InvoiceDownloadMutationComponent,
		EstimatesComponent,
		EstimateAddComponent,
		EstimateEditComponent,
		EstimatesReceivedComponent,
		EstimateViewComponent,
		InvoicePaymentsComponent,
		PaymentMutationComponent,
		InvoiceApplyTaxDiscountComponent,
		InvoiceExpensesSelectorComponent,
		InvoicePdfComponent,
		AddInternalNoteComponent,
		PublicLinkComponent,
		InvoicePaymentReceiptMutationComponent,
		InvoiceEstimateTotalValueComponent
	],
	exports: [InvoiceViewInnerComponent]
})
export class InvoicesModule {}
