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
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoiceTasksSelectorComponent } from './table-components/invoice-tasks-selector.component';
import { InvoiceProjectsSelectorComponent } from './table-components/invoice-project-selector.component';
import { InvoicesComponent } from './invoices.component';
import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { TasksService } from '../../@core/services/tasks.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { InvoiceEmployeesSelectorComponent } from './table-components/invoice-employees-selector.component';
import { EmployeesService } from '../../@core/services/employees.service';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { InvoicesReceivedComponent } from './invoices-received/invoices-received.component';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoiceViewComponent } from './invoice-view/invoice-view.component';
import { ProductService } from '../../@core/services/product.service';
import { InvoiceProductsSelectorComponent } from './table-components/invoice-product-selector.component';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceViewInnerComponent } from './invoice-view/inner-component/invoice-view-inner.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { EstimatesComponent } from './invoice-estimates/invoice-estimates.component';
import { EstimateAddComponent } from './invoice-estimates/estimate-add/estimate-add.component';
import { EstimateEditComponent } from './invoice-estimates/estimate-edit/estimate-edit.component';
import { EstimatesReceivedComponent } from './invoice-estimates/estimates-received/estimates-received.component';
import { EstimateViewComponent } from './invoice-estimates/estimate-view/estimate-view.component';
import { InvoicePaymentsComponent } from './invoice-payments/payments.component';
import { PaymentService } from '../../@core/services/payment.service';
import { PaymentMutationComponent } from './invoice-payments/payment-mutation/payment-mutation.component';
import { TasksStoreService } from '../../@core/services/tasks-store.service';
import { InvoiceApplyTaxDiscountComponent } from './table-components/invoice-apply-tax-discount.component';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { InvoiceExpensesSelectorComponent } from './table-components/invoice-expense-selector.component';
import { BackNavigationModule } from '../../@shared/back-navigation';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { NgxPermissionsModule } from 'ngx-permissions';
import { InvoicePdfComponent } from './invoice-pdf/invoice-pdf.component';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';
import { CurrencyModule } from '../../@shared/currency/currency.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { TranslatableService } from '../../@core/services/translatable.service';
import { PublicLinkComponent } from './public-link/public-link.component';
import { InvoicePaymentReceiptMutatonComponent } from './invoice-payments/payment-receipt-mutation/payment-receipt-mutation.component';

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
		CurrencyModule
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
		InvoicePaymentReceiptMutatonComponent
	],
	exports: []
})
export class InvoicesModule {}
