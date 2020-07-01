import { Component, OnInit } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Invoice, Tag } from '@gauzy/models';
import { InvoicesService } from '../../../@core/services/invoices.service';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-send-mutation.component.html',
	styleUrls: ['./invoice-send-mutation.component.scss']
})
export class InvoiceSendMutationComponent extends TranslationBaseComponent
	implements OnInit {
	invoice: Invoice;
	alreadySent = false;
	tags: Tag[];
	isEstimate: boolean;

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
			sentTo: this.invoice.toClient.contactOrganizationId,
			sentStatus: true
		});
		this.dialogRef.close();

		this.toastrService.primary(
			this.isEstimate
				? this.getTranslation('INVOICES_PAGE.SEND_ESTIMATE')
				: this.getTranslation('INVOICES_PAGE.SEND_INVOICE'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}
}
