import { Component, OnInit } from '@angular/core';
import { IInvoice } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { InvoicesService } from '../../../@core/services/invoices.service';

@Component({
	selector: 'public-link',
	templateUrl: './public-link.component.html'
})
export class PublicLinkComponent implements OnInit {
	invoice: IInvoice;
	show = true;

	constructor(
		protected dialogRef: NbDialogRef<PublicLinkComponent>,
		private invoicesService: InvoicesService
	) {}

	ngOnInit() {
		if (!this.invoice.publicLink) {
			this.generateLink();
		}
	}

	async generateLink() {
		const updatedInvoice = await this.invoicesService.generateLink(
			this.invoice.id,
			this.invoice.isEstimate
		);
		this.invoice = updatedInvoice;
	}

	copyToClipboard() {
		const textField = document.createElement('textarea');
		textField.innerText = `${this.invoice.publicLink}`;
		document.body.appendChild(textField);
		textField.select();
		document.execCommand('copy');
		textField.remove();
	}

	cancel() {
		this.dialogRef.close();
	}
}
