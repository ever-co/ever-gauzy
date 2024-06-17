import { Component, Input, OnInit } from '@angular/core';
import { Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { IInvoice } from '@gauzy/contracts';
import { __prepareExternalUrlLocation } from '@gauzy/ui-core/common';
import { NbDialogRef } from '@nebular/theme';
import { ClipboardService } from 'ngx-clipboard';
import { InvoicesService } from '@gauzy/ui-core/core';

@Component({
	selector: 'public-invoice-link',
	templateUrl: './public-link.component.html',
	styleUrls: ['./public-link.component.scss']
})
export class PublicLinkComponent implements OnInit {
	/*
	 * Getter & Setter for dynamic invoice property
	 */
	_invoice: IInvoice;
	get invoice(): IInvoice {
		return this._invoice;
	}
	@Input() set invoice(value: IInvoice) {
		this._invoice = value;
		this.createPublicLink();
	}

	publicLink: IInvoice['token'];

	constructor(
		private readonly _router: Router,
		private readonly _location: Location,
		private readonly _urlSerializer: UrlSerializer,
		protected readonly _clipboardService: ClipboardService,
		protected readonly _dialogRef: NbDialogRef<PublicLinkComponent>,
		private readonly _invoicesService: InvoicesService
	) {
		/**
		 * Destroyed textarea element after each copy to clipboard
		 */
		_clipboardService.configure({ cleanUpAfterCopy: true });
	}

	ngOnInit() {
		if (!this.invoice.token) {
			this.generatePublicInvoiceLink();
		}
	}

	async generatePublicInvoiceLink() {
		this.invoice = await this._invoicesService.generateLink(this.invoice.id);
	}

	/**
	 * Create invoice public link
	 */
	createPublicLink() {
		if (this.invoice) {
			const { id, token } = this.invoice;
			// The call to Location.prepareExternalUrl is the key thing here.
			let tree = this._router.createUrlTree([`/share/invoices/${id}/${token}`]);

			// As far as I can tell you don't really need the UrlSerializer.
			this.publicLink = __prepareExternalUrlLocation(
				this._location.prepareExternalUrl(this._urlSerializer.serialize(tree))
			);
		}
	}

	cancel() {
		this._dialogRef.close();
	}
}
