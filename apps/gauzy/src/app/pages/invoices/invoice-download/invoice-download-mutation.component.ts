import { Component, OnInit } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { IInvoice, InvoiceTypeEnum } from '@gauzy/models';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { EmployeesService } from '../../../@core/services';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ProductService } from '../../../@core/services/product.service';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-invoice-download',
	templateUrl: './invoice-download-mutation.component.html',
	styleUrls: ['./invoice-download-mutation.component.scss']
})
export class InvoiceDownloadMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	invoice: IInvoice;
	isEstimate: boolean;
	docDefinition: any;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceDownloadMutationComponent>,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadPdf();
	}

	async closeDialog() {
		this.dialogRef.close();
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

	async download() {
		pdfMake
			.createPdf(this.docDefinition)
			.download(
				`${this.isEstimate ? 'Estimate' : 'Invoice'}-${
					this.invoice.invoiceNumber
				}.pdf`
			);

		this.dialogRef.close();

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? 'Estimate downloaded'
				: 'Invoice downloaded',
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id,
			tenantId: this.invoice.fromOrganization.tenantId
		});

		this.toastrService.primary(
			this.isEstimate
				? this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				  )
				: this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
				  ),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}
}
