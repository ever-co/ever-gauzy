import { NgModule } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { ClipboardModule } from 'ngx-clipboard';
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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { PublicLinkComponent } from './public-link/public-link.component';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
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
import {
	InvoicePaymentReceiptMutationComponent,
	InvoicePaymentsComponent,
	PaymentMutationComponent
} from './invoice-payments';
import { InvoiceViewComponent, InvoiceViewInnerComponent } from './invoice-view';
import { SharedModule } from '../../@shared/shared.module';
import { ContactSelectModule } from '../../@shared/contact-select/contact-select.module';
import { CurrencyPositionPipe } from '../../@shared/pipes';
import { NbAccordionModule } from '@nebular/theme';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { ProjectSelectModule } from '../../@shared/project-select/project-select.module';

@NgModule({
	imports: [
		TableComponentsModule,
		TagsColorInputModule,
		InvoicesRoutingModule,
		ClipboardModule,
		NbCardModule,
		NbSpinnerModule,
		NbIconModule,
		NbButtonModule,
		Angular2SmartTableModule,
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
		PaginationV2Module,
		ContactSelectModule,
		ProjectSelectModule,
		SharedModule,
		NbAccordionModule,
		GauzyButtonActionModule
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
		TranslatableService,
		CurrencyPipe,
		CurrencyPositionPipe
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
