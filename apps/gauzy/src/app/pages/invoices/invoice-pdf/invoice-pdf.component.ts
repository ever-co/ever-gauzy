import { Component, Input, OnInit } from '@angular/core';
import { IInvoice } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { InvoicesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-pdf',
	template: `@if (fileURL) {
  <iframe
    type="application/pdf"
    id="iframe"
    class="pdfDoc"
    [src]="fileURL | safeUrl"
    frameBorder="0"
  ></iframe>
}
@if (isLoading) {
  <div
    [nbSpinner]="isLoading"
    nbSpinnerStatus="primary"
    nbSpinnerSize="large"
    class="pdfDoc loading"
  ></div>
}
@if (error) {
  <div class="pdfDoc error">An error occurred, please reload.</div>
}`,
	styles: [
		// The preview fills whatever box the dialog gives it. It used to carry
		// `::ng-deep .pdf-preview-card { height: 90vh; resize: horizontal }` — written
		// without a `:host`, so Angular emitted it as a global rule that stretched every
		// dialog with that class to 90vh, even the Send dialog's one-line "already sent"
		// message — and a `60vw` iframe that ignored the dialog's own width.
		`
			:host {
				display: block;
				position: relative;
				width: 100%;
				height: 100%;
			}
			.pdfDoc {
				display: block;
				width: 100%;
				height: 100%;
				min-height: 20rem;
				border-radius: var(--gauzy-radius-sm, 0.375rem);
				background-color: var(--gauzy-card-2, rgba(126, 126, 143, 0.06));
			}
			.loading,
			.error {
				display: flex;
				align-items: center;
				justify-content: center;
			}
			.error {
				font-size: 12px;
				font-weight: 600;
				color: var(--color-danger-default, #dc3545);
			}
		`
	],
	standalone: false
})
export class InvoicePdfComponent extends TranslationBaseComponent implements OnInit {
	@Input() invoice: IInvoice;
	fileURL: string;
	isLoading: boolean;
	error: boolean;

	constructor(private readonly invoicesService: InvoicesService, readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.isLoading = true;
		this.error = false;
		this.loadInvoicePdf();
	}

	async loadInvoicePdf() {
		const { id: invoiceId } = this.invoice;
		this.invoicesService
			.downloadInvoicePdf(invoiceId)
			.pipe(
				tap((data) => this.embeddedPdfToIframe(data)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	embeddedPdfToIframe(data) {
		const url = window.URL || window.webkitURL;
		const rawUrl = url.createObjectURL(data);
		this.fileURL = this.filterUrl(rawUrl) ? rawUrl : null;
		this.error = !this.filterUrl(rawUrl);
		this.isLoading = false;
	}

	filterUrl(url: string) {
		const baseUrl = window.location.origin;
		const uuidPattern = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
		let isFilterUrl = false;
		let uri = 'blob:' + baseUrl + '/';
		let regex = new RegExp(uri);
		if (regex.test(url)) {
			const uuid = url.replace(uri, '');
			regex = new RegExp(uuidPattern);
			isFilterUrl = regex.test(uuid);
		}
		return isFilterUrl;
	}
}
