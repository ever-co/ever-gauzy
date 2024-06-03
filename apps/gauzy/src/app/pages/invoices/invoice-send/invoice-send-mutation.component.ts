import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { IInvoice, ITag, InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Store } from '@gauzy/ui-sdk/common';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { ToastrService } from '@gauzy/ui-sdk/core';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-send-mutation.component.html',
	styleUrls: ['./invoice-send-mutation.component.scss']
})
export class InvoiceSendMutationComponent extends TranslationBaseComponent implements OnInit {
	invoice: IInvoice;
	alreadySent = false;
	tags: ITag[];
	isEstimate: boolean;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceSendMutationComponent>,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private store: Store
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
			sentTo: this.invoice.organizationContactId,
			status: InvoiceStatusTypesEnum.SENT
		});
		this.dialogRef.close();

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE_SENT_TO', {
						name: this.invoice.toContact.name
				  })
				: this.getTranslation('INVOICES_PAGE.INVOICE_SENT_TO', {
						name: this.invoice.toContact.name
				  }),
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id
		});

		this.toastrService.success(this.isEstimate ? 'INVOICES_PAGE.SEND_ESTIMATE' : 'INVOICES_PAGE.SEND_INVOICE');
	}
}
