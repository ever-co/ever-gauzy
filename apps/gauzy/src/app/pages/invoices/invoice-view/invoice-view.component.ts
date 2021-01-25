import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { IInvoice, InvoiceTypeEnum, IUser } from '@gauzy/contracts';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import { EmployeesService } from '../../../@core/services';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ProductService } from '../../../@core/services/product.service';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../@core/services/store.service';
import { filter } from 'rxjs/operators';
import { ToastrService } from '../../../@core/services/toastr.service';
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
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private toastrService: ToastrService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService,
		private store: Store
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
