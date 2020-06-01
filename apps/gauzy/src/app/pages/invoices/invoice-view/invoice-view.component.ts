import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Invoice, OrganizationClients, Organization } from '@gauzy/models';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { Subject } from 'rxjs';
import * as jspdf from 'jspdf';
import * as html2canvas from 'html2canvas';
import { OrganizationsService } from '../../../@core/services/organizations.service';

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

	constructor(
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private organizationClientsService: OrganizationClientsService,
		private organizationService: OrganizationsService
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

	download() {
		const data = document.getElementById('contentToConvert');
		(html2canvas as any)(data).then((canvas) => {
			const imgWidth = 208;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			const contentDataURL = canvas.toDataURL('image/png');
			const pdf = new jspdf('l', 'mm', 'a4');
			const position = 0;
			pdf.addImage(
				contentDataURL,
				'PNG',
				0,
				position,
				imgWidth,
				imgHeight
			);
			pdf.save(`Invoice ${this.invoice.invoiceNumber}`);
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
