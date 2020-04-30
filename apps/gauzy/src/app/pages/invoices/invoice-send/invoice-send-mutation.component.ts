import { Component, OnInit } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OrganizationClients, Invoice } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { first } from 'rxjs/operators';
import { InvoicesService } from '../../../@core/services/invoices.service';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-send-mutation.component.html',
	styleUrls: ['./invoice-send-mutation.component.scss']
})
export class InvoiceSendMutationComponent extends TranslationBaseComponent
	implements OnInit {
	client: OrganizationClients;
	invoice: Invoice;
	alreadySent = false;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceSendMutationComponent>,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit() {
		if (this.invoice.sentTo) {
			this.alreadySent = true;
		}
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	async send() {
		await this.invoicesService.update(this.invoice.id, {
			invoiceNumber: this.invoice.invoiceNumber,
			invoiceDate: this.invoice.invoiceDate,
			dueDate: this.invoice.dueDate,
			currency: this.invoice.currency,
			discountValue: this.invoice.discountValue,
			discountType: this.invoice.discountType,
			tax: this.invoice.tax,
			taxType: this.invoice.taxType,
			terms: this.invoice.terms,
			paid: this.invoice.paid,
			totalValue: this.invoice.totalValue,
			clientId: this.invoice.clientId,
			organizationId: this.invoice.organizationId,
			sentTo: this.client.organizationId
		});
		this.dialogRef.close();

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.SEND_INVOICE'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}
}
