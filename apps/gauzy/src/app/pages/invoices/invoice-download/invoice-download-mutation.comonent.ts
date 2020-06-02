import { Component } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OrganizationClients, Invoice, Organization } from '@gauzy/models';
import * as jspdf from 'jspdf';
import * as html2canvas from 'html2canvas';

@Component({
	selector: 'ga-invoice-send',
	templateUrl: './invoice-download-mutation.component.html',
	styleUrls: ['./invoice-download-mutation.component.scss']
})
export class InvoiceDownloadMutationComponent extends TranslationBaseComponent {
	client: OrganizationClients;
	invoice: Invoice;
	organization: Organization;
	isEstimate: boolean;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceDownloadMutationComponent>,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	download() {
		const data = document.getElementsByClassName('contentToConvert')[0];
		(html2canvas as any)(data).then((canvas) => {
			const imgWidth = 102;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			const contentDataURL = canvas.toDataURL('image/png');
			const pdf = new jspdf('p', 'mm', 'a4');
			const position = 0;
			pdf.addImage(
				contentDataURL,
				'PNG',
				0,
				position,
				imgWidth,
				imgHeight
			);
			pdf.save(
				`${this.isEstimate ? 'Estimate' : 'Invoice'} ${
					this.invoice.invoiceNumber
				}`
			);
		});
		this.dialogRef.close();

		this.toastrService.primary(
			this.isEstimate
				? this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				  )
				: this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
				  ),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}
}
