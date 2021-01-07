import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { IInvoice } from '@gauzy/models';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';

@Component({
	selector: 'ga-invoice-download',
	templateUrl: './invoice-download-mutation.component.html'
})
export class InvoiceDownloadMutationComponent extends TranslationBaseComponent {
	invoice: IInvoice;
	isEstimate: boolean;
	docDefinition: any;

	constructor(
		protected dialogRef: NbDialogRef<InvoiceDownloadMutationComponent>,
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private store: Store
	) {
		super(translateService);
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	getDocDef(event) {
		this.docDefinition = event;
	}

	async download() {
		pdfMake
			.createPdf(this.docDefinition)
			.download(
				`${this.isEstimate ? 'Estimate' : 'Invoice'}-${
					this.invoice.invoiceNumber
				}.pdf`
			);

		this.dialogRef.close();

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? 'Estimate downloaded'
				: 'Invoice downloaded',
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id,
			tenantId: this.invoice.fromOrganization.tenantId
		});

		this.toastrService.success(
			this.isEstimate
				? 'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				: 'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
		);
	}
}
