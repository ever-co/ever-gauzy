import { Component } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Invoice, InvoiceTypeEnum } from '@gauzy/models';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { EmployeesService } from '../../../@core/services';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ProductService } from '../../../@core/services/product.service';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-download-mutation.component.html'
})
export class InvoiceDownloadMutationComponent extends TranslationBaseComponent {
	invoice: Invoice;
	isEstimate: boolean;
	tableBody: any;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceDownloadMutationComponent>,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService
	) {
		super(translateService);
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	async download() {
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
			default:
				break;
		}

		docDefinition = await generatePdf(
			this.invoice,
			this.invoice.fromOrganization,
			this.invoice.toClient,
			service
		);

		pdfMake
			.createPdf(docDefinition)
			.download(
				`${this.isEstimate ? 'Estimate' : 'Invoice'}-${
					this.invoice.invoiceNumber
				}.pdf`
			);

		this.dialogRef.close();

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
