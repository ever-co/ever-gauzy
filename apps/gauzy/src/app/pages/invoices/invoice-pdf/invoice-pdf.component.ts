import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IInvoice, InvoiceTypeEnum } from '@gauzy/models';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { EmployeesService } from '../../../@core/services';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { ProductService } from '../../../@core/services/product.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';

@Component({
	selector: 'ga-invoice-pdf',
	template: `<iframe id="iframe" class="pdfDoc"></iframe>`,
	styles: [
		`
			::ng-deep .pdf-preview-card {
				height: 90vh;
			}

			.pdfDoc {
				height: 100%;
				width: 100%;
			}
		`
	]
})
export class InvoicePdfComponent implements OnInit {
	@Input() invoice: IInvoice;
	@Output() docDef = new EventEmitter();
	docDefinition: any;

	constructor(
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService
	) {}

	ngOnInit() {
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

		this.docDef.emit(docDefinition);

		this.docDefinition = docDefinition;

		const pdfDocGenerator = pdfMake.createPdf(docDefinition);
		pdfDocGenerator.getDataUrl((dataUrl) => {
			const iframe = document.querySelector(
				'#iframe'
			) as HTMLIFrameElement;
			iframe.src = dataUrl;
		});
	}
}
