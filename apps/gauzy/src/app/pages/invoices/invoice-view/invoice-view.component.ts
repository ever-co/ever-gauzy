import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import {
	Invoice,
	OrganizationClients,
	Organization,
	InvoiceTypeEnum
} from '@gauzy/models';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { Subject } from 'rxjs';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { generatePdf } from '../../../@shared/invoice/generate-pdf';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ProductService } from '../../../@core/services/product.service';

@Component({
	selector: 'ga-invoice-view',
	templateUrl: './invoice-view.component.html',
	styleUrls: ['./invoice-view.component.scss']
})
export class InvoiceViewComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceId: string;
	invoice: Invoice;
	client: OrganizationClients;
	organization: Organization;
	private _ngDestroy$ = new Subject<void>();

	@Input() isEstimate: boolean;

	constructor(
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private organizationClientsService: OrganizationClientsService,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.paramMap.subscribe(async (params) => {
			this.invoiceId = params.get('id');
		});
		this.getInvoice();
	}

	async getInvoice() {
		const invoice = await this.invoicesService.getById(this.invoiceId, [
			'invoiceItems'
		]);
		this.invoice = invoice;
		const client = await this.organizationClientsService.getById(
			this.invoice.clientId
		);
		this.client = client;
		this.organizationService
			.getById(this.invoice.organizationId)
			.subscribe((org) => (this.organization = org));
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
			this.organization,
			this.client,
			service
		);

		pdfMake
			.createPdf(docDefinition)
			.download(
				`${this.isEstimate ? 'Estimate' : 'Invoice'}-${
					this.invoice.invoiceNumber
				}.pdf`
			);

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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
