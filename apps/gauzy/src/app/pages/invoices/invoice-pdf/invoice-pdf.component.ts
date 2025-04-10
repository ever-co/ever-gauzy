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
	template: `
		<iframe
			type="application/pdf"
			id="iframe"
			class="pdfDoc"
			[src]="fileURL | safeUrl"
			frameBorder="0"
			*ngIf="fileURL"
		></iframe>
		<div
			[nbSpinner]="isLoading"
			nbSpinnerStatus="primary"
			nbSpinnerSize="large"
			class="pdfDoc loading"
			*ngIf="isLoading"
		></div>
		<div class="pdfDoc error" *ngIf="error">An error occurred, please reload.</div>
	`,
	styles: [
		`
			::ng-deep .pdf-preview-card {
				height: 90vh;
				resize: horizontal;
			}
			.error {
				color: red;
				font-weight: bold;
			}
			.pdfDoc {
				height: 100%;
				width: 60vw;
			}
		`
	]
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

	loadInvoicePdf() {
		if (!this.invoice?.id) {
			this.isLoading = false;
			return;
		}

		const { id: invoiceId } = this.invoice;

		this.invoicesService
			.downloadInvoicePdf(invoiceId)
			.pipe(
				tap((data) => {
					if (data && data instanceof Blob) {
						this.embeddedPdfToIframe(data);
					} else {
						this.error = true;
						console.error('Received data is not a valid PDF blob or is an HTML response.');
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	embeddedPdfToIframe(data: Blob) {
		const url = window.URL || window.webkitURL;
		if (!url) {
			this.error = true;
			console.error('Browser does not support URL.createObjectURL.');
			this.isLoading = false;
			return;
		}

		try {
			const rawUrl = url.createObjectURL(data);
			this.fileURL = this.filterUrl(rawUrl) ? rawUrl : null;
			this.error = !this.filterUrl(rawUrl);
		} catch (e) {
			this.error = true;
			console.error('Error creating object URL:', e);
		}

		this.isLoading = false;
	}

	filterUrl(url: string) {
		const baseUrl = window.location.origin;
		const uuidPattern = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
		let isFilterUrl = false;
		const uri = 'blob:' + baseUrl + '/';
		let regex = new RegExp(uri);
		if (regex.test(url)) {
			const uuid = url.replace(uri, '');
			regex = new RegExp(uuidPattern);
			isFilterUrl = regex.test(uuid);
		}
		return isFilterUrl;
	}
}
