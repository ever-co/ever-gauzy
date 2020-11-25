import { Component, OnInit } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import {
	IInvoice,
	ITag,
	InvoiceStatusTypesEnum,
	InvoiceTypeEnum
} from '@gauzy/models';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Store } from '../../../@core/services/store.service';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { EmployeesService } from '../../../@core/services';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ProductService } from '../../../@core/services/product.service';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-send-mutation.component.html',
	styleUrls: ['./invoice-send-mutation.component.scss']
})
export class InvoiceSendMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	invoice: IInvoice;
	alreadySent = false;
	tags: ITag[];
	isEstimate: boolean;
	docDefinition: any;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceSendMutationComponent>,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private store: Store,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService
	) {
		super(translateService);
	}

	ngOnInit() {
		if (this.invoice.sentTo) {
			this.alreadySent = true;
		}
		this.loadPdf();
	}

	async loadPdf() {
		pdfMake.vfs = pdfFonts.pdfMake.vfs;
		let docDefinition;
		let service;

		switch (this.invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				service = this.employeeService;
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				service = this.projectService;
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				service = this.taskService;
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				service = this.productService;
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				service = this.expensesService;
				break;
			default:
				break;
		}

		docDefinition = await generatePdf(
			this.invoice,
			this.invoice.fromOrganization,
			this.invoice.toContact,
			service
		);

		this.docDefinition = docDefinition;

		const pdfDocGenerator = pdfMake.createPdf(docDefinition);
		pdfDocGenerator.getDataUrl((dataUrl) => {
			const iframe = document.querySelector(
				'#iframe'
			) as HTMLIFrameElement;
			iframe.src = dataUrl;
		});
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	async send() {
		await this.invoicesService.update(this.invoice.id, {
			sentTo: this.invoice.organizationContactId,
			status: InvoiceStatusTypesEnum.SENT
		});
		this.dialogRef.close();

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? `Estimate sent to ${this.invoice.toContact.name}`
				: `Invoice sent to ${this.invoice.toContact.name}`,
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id
		});

		this.toastrService.primary(
			this.isEstimate
				? this.getTranslation('INVOICES_PAGE.SEND_ESTIMATE')
				: this.getTranslation('INVOICES_PAGE.SEND_INVOICE'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}
}
