import { Component, Input, OnInit } from '@angular/core';
import { IInvoice } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { InvoicesService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-pdf',
	template: `<iframe
		type="application/pdf"
		id="iframe"
		class="pdfDoc"
		[src]="fileURL | safeUrl"
		frameBorder="0"
	></iframe>`,
	styles: [
		`
			::ng-deep .pdf-preview-card {
				height: 90vh;
				resize: horizontal;
			}

			.pdfDoc {
				height: 100%;
				width: 60vw;
			}
		`
	]
})
export class InvoicePdfComponent
	extends TranslationBaseComponent
	implements OnInit
{
	@Input() invoice: IInvoice;
	fileURL: string;

	constructor(
		private readonly invoicesService: InvoicesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
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
		this.fileURL = url.createObjectURL(data);
	}
}
