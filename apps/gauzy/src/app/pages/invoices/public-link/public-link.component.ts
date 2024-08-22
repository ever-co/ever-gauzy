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
	public publicLink: string;
	public isCopied: boolean = false; // Track if link has been copied

	/*
	 * Getter & Setter for dynamic invoice property
	 */
	private _invoice: IInvoice;
	public get invoice(): IInvoice {
		return this._invoice;
	}
	@Input() public set invoice(value: IInvoice) {
		this._invoice = value;
		this.createPublicLink();
	}

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

	/**
	 * Generate public invoice link
	 */
	async generatePublicInvoiceLink() {
		this.invoice = await this._invoicesService.generateLink(this.invoice.id);
	}

	/**
	 * Create invoice public link
	 */
	createPublicLink() {
		if (!this.invoice) {
			return;
		}
		const { id, token, isEstimate } = this.invoice;
		// Define the base URL based on whether it's an estimate or an invoice
		const basePath = isEstimate ? 'estimates' : 'invoices';
		// Create the URL tree with the appropriate path
		const urlTree = this._router.createUrlTree([`/share/${basePath}/${id}/${token}`]);
		// Serialize the URL tree and prepare the external URL
		const serializedUrl = this._urlSerializer.serialize(urlTree);
		// As far as I can tell you don't really need the UrlSerializer.
		this.publicLink = __prepareExternalUrlLocation(this._location.prepareExternalUrl(serializedUrl));
	}

	/**
	 * Copy to clipboard
	 */
	copyLink() {
		try {
			this._clipboardService.copyFromContent(this.publicLink); // Copy the link to clipboard
			this.isCopied = true; // Show "Copied" status

			// Hide "Copied" status after 2 seconds
			setTimeout(() => {
				this.isCopied = false;
			}, 2000);
		} catch (error) {
			// Fallback for older browsers
			this.fallbackCopyToClipboard(this.publicLink);
		}
	}

	/**
	 * Fallback copy to clipboard
	 *
	 * @param text
	 */
	private fallbackCopyToClipboard(text: string) {
		// Create a temporary element to copy the link
		const textArea = document.createElement('textarea');
		textArea.value = text;

		// Append the element to the body
		document.body.appendChild(textArea);
		textArea.select();

		try {
			document.execCommand('copy');
			console.log('Link copied to clipboard');
		} catch (error) {
			console.error('Failed to copy: ', error);
		}

		document.body.removeChild(textArea);
	}

	/**
	 * Close the dialog
	 */
	close() {
		this._dialogRef.close();
	}
}
