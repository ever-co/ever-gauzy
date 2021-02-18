import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IInvoice, InvoiceTypeEnum, IUser } from '@gauzy/contracts';
import { filter } from 'rxjs/operators';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import {
	EmployeesService,
	ExpensesService,
	InvoicesService,
	OrganizationProjectsService,
	ProductService,
	Store,
	TasksService,
	ToastrService
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-view',
	templateUrl: './invoice-view.component.html',
	styleUrls: ['./invoice-view.component.scss']
})
export class InvoiceViewComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceId: string;
	tenantId: string;
	invoice: IInvoice;

	@Input() isEstimate: boolean;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		private readonly toastrService: ToastrService,
		private readonly employeeService: EmployeesService,
		private readonly projectService: OrganizationProjectsService,
		private readonly taskService: TasksService,
		private readonly productService: ProductService,
		private readonly expensesService: ExpensesService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.paramMap
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
				this.invoiceId = params.get('id');
			});
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe((user: IUser) => {
				this.tenantId = user.tenantId;
				if (this.invoiceId) {
					this.getInvoice();
				}
			});
	}

	async getInvoice() {
		const { tenantId } = this;
		const invoice = await this.invoicesService.getById(
			this.invoiceId,
			[
				'invoiceItems',
				'invoiceItems.employee',
				'invoiceItems.employee.user',
				'invoiceItems.project',
				'invoiceItems.product',
				'invoiceItems.invoice',
				'invoiceItems.expense',
				'invoiceItems.task',
				'fromOrganization',
				'toContact'
			],
			{ tenantId }
		);
		this.invoice = invoice;
	}

	async downloadInvoice() {
		const { id: invoiceId } = this.invoice;
		this.invoicesService.downloadInvoicePdf(invoiceId);
	}

	async download() {
		this.downloadInvoice();

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
		pdfMake
			.createPdf(docDefinition)
			.download(
				`${
					this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE')
						: this.getTranslation('INVOICES_PAGE.INVOICE')
				}-${this.invoice.invoiceNumber}.pdf`
			);

		this.toastrService.success(
			this.isEstimate
				? 'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				: 'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
		);
	}

	ngOnDestroy() {}
}
