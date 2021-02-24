import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { IInvoice } from '@gauzy/contracts';
import { saveAs } from 'file-saver';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';
import { InvoicesService } from '../../../@core/services';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-download',
	templateUrl: './invoice-download-mutation.component.html'
})
export class InvoiceDownloadMutationComponent extends TranslationBaseComponent {
	invoice: IInvoice;
	isEstimate: boolean;

	constructor(
		protected readonly dialogRef: NbDialogRef<InvoiceDownloadMutationComponent>,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly invoicesService: InvoicesService,
		private readonly store: Store
	) {
		super(translateService);
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	async download() {
		const { id: invoiceId } = this.invoice;
		this.invoicesService
			.downloadInvoicePdf(invoiceId)
			.pipe(
				tap((data) => this.downloadFile(data)),
				tap(() => this.createInvoiceHistory()),
				tap(() => this.closeDialog()),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.toastrService.success(
					this.isEstimate
						? 'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
						: 'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
				);
			});
	}

	downloadFile(data) {
		const filename = `${
			this.isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE')
				: this.getTranslation('INVOICES_PAGE.INVOICE')
		}-${this.invoice.invoiceNumber}.pdf`;
		saveAs(data, filename);
	}

	async createInvoiceHistory() {
		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				  )
				: this.getTranslation(
						'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD'
				  ),
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organizationId: this.invoice.fromOrganization.id,
			tenantId: this.invoice.fromOrganization.tenantId
		});
	}
}
