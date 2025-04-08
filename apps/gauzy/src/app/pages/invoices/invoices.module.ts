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
	NbListModule,
	NbAccordionModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { ClipboardModule } from 'ngx-clipboard';
import { NgxPermissionsModule } from 'ngx-permissions';
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
} from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { InvoiceAddByOrganizationComponent } from './invoice-add/by-organization/invoice-add-by-organization.component';
import { InvoiceAddByRoleComponent } from './invoice-add/by-role/invoice-add-by-role.component';
import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoiceEditByOrganizationComponent } from './invoice-edit/by-organization/invoice-edit-by-organization.component';
import { InvoicesReceivedComponent } from './invoices-received/invoices-received.component';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	ContactSelectModule,
	CurrencyModule,
	CurrencyPositionPipe,
	EmployeeMultiSelectModule,
	ProjectSelectModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	UserFormsModule,
	InvoiceViewInnerModule,
	SelectorsModule
} from '@gauzy/ui-core/shared';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { InvoicePdfComponent } from './invoice-pdf/invoice-pdf.component';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';
import { PublicLinkComponent } from './public-link/public-link.component';
import {
	InvoiceApplyTaxDiscountComponent,
	InvoiceEmployeesSelectorComponent,
	InvoiceExpensesSelectorComponent,
	InvoicePaidComponent,
	InvoiceProductsSelectorComponent,
	InvoiceProjectsSelectorComponent,
	InvoiceTasksSelectorComponent
} from './table-components';
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
import { InvoiceViewComponent } from './invoice-view/invoice-view.component';
import { InvoiceEditByRoleComponent } from './invoice-edit/by-role/invoice-edit-by-role.component';
import { InvoicesByOrganizationComponent } from './invoices/by-organization/invoices-by-organization.component';
import { InvoicesByRoleComponent } from './invoices/by-role/invoices-by-role.component';

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
		CardGridModule,
		NbBadgeModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
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
		NbPopoverModule,
		NbFormFieldModule,
		NbListModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		CurrencyModule,
		SmartDataViewLayoutModule,
		ContactSelectModule,
		ProjectSelectModule,
		SharedModule,
		NbAccordionModule,
		InvoiceViewInnerModule,
		SelectorsModule
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
		InvoiceAddByOrganizationComponent,
		InvoiceAddByRoleComponent,
		InvoiceTasksSelectorComponent,
		InvoiceProjectsSelectorComponent,
		InvoiceEmployeesSelectorComponent,
		InvoiceEditByOrganizationComponent,
		InvoiceEditByRoleComponent,
		InvoicesReceivedComponent,
		InvoiceSendMutationComponent,
		InvoiceViewComponent,
		InvoiceProductsSelectorComponent,
		InvoicePaidComponent,
		InvoiceEmailMutationComponent,
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
		InvoicesByOrganizationComponent,
		InvoicesByRoleComponent
	],
	exports: []
})
export class InvoicesModule {}
