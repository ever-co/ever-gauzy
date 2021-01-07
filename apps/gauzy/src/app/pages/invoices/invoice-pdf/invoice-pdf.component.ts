import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IInvoice, InvoiceTypeEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { EmployeesService } from '../../../@core/services';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { ProductService } from '../../../@core/services/product.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

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
export class InvoicePdfComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() invoice: IInvoice;
	@Output() docDef = new EventEmitter();
	docDefinition: any;
	translatedText: any;

	constructor(
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

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

		this.translatedText = {
			description: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
			),
			quantity: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
			),
			price: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
			totalValue: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
			),
			item: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.ITEM'),
			invoice: this.getTranslation('INVOICES_PAGE.INVOICE'),
			estimate: this.getTranslation('INVOICES_PAGE.ESTIMATE'),
			number: this.getTranslation('INVOICES_PAGE.NUMBER'),
			from: this.getTranslation('INVOICES_PAGE.FROM'),
			to: this.getTranslation('INVOICES_PAGE.TO'),
			date: this.getTranslation('INVOICES_PAGE.DATE'),
			dueDate: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
			discountValue: this.getTranslation(
				'INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE'
			),
			discountType: this.getTranslation('INVOICES_PAGE.DISCOUNT_TYPE'),
			taxValue: this.getTranslation('INVOICES_PAGE.TAX_VALUE'),
			taxType: this.getTranslation('INVOICES_PAGE.TAX_TYPE'),
			currency: this.getTranslation('INVOICES_PAGE.CURRENCY'),
			terms: this.getTranslation('INVOICES_PAGE.INVOICES_SELECT_TERMS'),
			paid: this.getTranslation('INVOICES_PAGE.PAID'),
			yes: this.getTranslation('INVOICES_PAGE.YES'),
			no: this.getTranslation('INVOICES_PAGE.NO')
		};

		docDefinition = await generatePdf(
			this.invoice,
			this.invoice.fromOrganization,
			this.invoice.toContact,
			service,
			this.translatedText
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
