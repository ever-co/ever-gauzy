import { Component, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { Observable, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import { ID, IInvoice } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ErrorHandlingService, InvoicesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-invoice-view',
    templateUrl: './invoice-view.component.html',
    styleUrls: ['./invoice-view.component.scss'],
    standalone: false
})
export class InvoiceViewComponent extends TranslationBaseComponent implements OnInit {
	public invoice: IInvoice;
	public invoice$: Observable<IInvoice>;

	@Input() isEstimate: boolean;

	constructor(
		readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _invoicesService: InvoicesService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _router: Router,
		private readonly _dialogService: NbDialogService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		const relations = [
			'invoiceItems',
			'invoiceItems.employee',
			'invoiceItems.employee.user',
			'invoiceItems.project',
			'invoiceItems.product',
			'invoiceItems.invoice',
			'invoiceItems.expense',
			'invoiceItems.task',
			'fromOrganization',
			'toContact'
		];

		this.invoice$ = this._activatedRoute.paramMap.pipe(
			// Filter for the presence of id in route params
			filter((params: ParamMap) => !!params.get('id')),
			// Map the id to an observable
			map((params: ParamMap) => params.get('id')),
			// Switch to route data stream once id and token are confirmed
			switchMap((id: ID) =>
				this._invoicesService.getById(id, relations, { tenantId: this._store.user.tenantId })
			),
			map((invoice: IInvoice) => {
				this.invoice = invoice;
				return invoice;
			}),
			// Catch errors here
			catchError((error) => {
				console.log('Error while getting public invoice', error);
				this._errorHandlingService.handleError(error);
				return of(null);
			}),
			// Automatically unsubscribe when the component is destroyed
			untilDestroyed(this)
		);
	}

	/**
	 * Downloads the invoice or estimate PDF.
	 */
	async download(): Promise<void> {
		try {
			const { id: invoiceId } = this.invoice;

			// Download the invoice PDF
			const data = await firstValueFrom(this._invoicesService.downloadInvoicePdf(invoiceId));
			this.downloadFile(data);

			// Show a success toastr message
			const translationKey = this.isEstimate
				? 'INVOICES_PAGE.DOWNLOAD.ESTIMATE_DOWNLOAD'
				: 'INVOICES_PAGE.DOWNLOAD.INVOICE_DOWNLOAD';
			this._toastrService.success(translationKey);
		} catch (error) {
			console.log('Error downloading invoice PDF:', error);
			this._toastrService.error('INVOICES_PAGE.DOWNLOAD.ERROR');
		}
	}

	/**
	 * Downloads the invoice or estimate file.
	 *
	 * @param data The file data to be downloaded.
	 */
	downloadFile(data: Blob): void {
		// Get the file type based on whether the invoice is an estimate or not
		const fileType = this.isEstimate
			? this.getTranslation('INVOICES_PAGE.ESTIMATE')
			: this.getTranslation('INVOICES_PAGE.INVOICE');

		// Construct the filename based on the file type and invoice number
		const filename = `${fileType}-${this.invoice.invoiceNumber}.pdf`;

		// Download the file using the FileSaver library
		saveAs(data, filename);
	}

	/**
	 * Edits the invoice/estimate
	 */
	edit(): void {
		// Define the route for the edit page
		const route = this.isEstimate ? `/pages/accounting/invoices/estimates/edit` : `/pages/accounting/invoices/edit`;
		// Navigate to the edit page with the invoice ID as a parameter
		const { id: invoiceId } = this.invoice;
		// Navigate to the edit page with the invoice ID as a parameter
		this._router.navigate([route, invoiceId]);
	}

	/**
	 * Deletes the invoice/estimate
	 */
	async delete(): Promise<void> {
		// Define the record type for the delete confirmation dialog
		const recordType = this.isEstimate ? 'INVOICES_PAGE.ESTIMATE' : 'INVOICES_PAGE.INVOICE';

		const result = await firstValueFrom(
			this._dialogService.open(DeleteConfirmationComponent, {
				context: {
					isRecord: false,
					recordType: this.getTranslation(recordType)
				}
			}).onClose
		);

		if (result) {
			try {
				// Delete the invoice
				await this._invoicesService.delete(this.invoice.id);

				const successMessage = this.isEstimate
					? 'INVOICES_PAGE.INVOICES_DELETE_ESTIMATE'
					: 'INVOICES_PAGE.INVOICES_DELETE_INVOICE';

				this._toastrService.success(successMessage);

				const navigatePath = this.isEstimate
					? `/pages/accounting/invoices/estimates`
					: `/pages/accounting/invoices`;

				this._router.navigate([navigatePath]);
			} catch (error) {
				console.error('Error deleting invoice:', error);
				this._toastrService.danger('Error occurred while deleting the invoice.');
			}
		}
	}

	/**
	 * Prints the invoice/estimate
	 */
	public async print(): Promise<void> {
		try {
			if (!this.invoice) {
				return;
			}

			const { id: invoiceId } = this.invoice;

			// Download the invoice PDF
			const blob = await firstValueFrom(this._invoicesService.downloadInvoicePdf(invoiceId));
			const fileURL = URL.createObjectURL(blob);

			// Create an iframe to display the PDF
			const iframe = document.createElement('iframe');
			iframe.src = fileURL;

			// Append the iframe to the document body
			document.body.appendChild(iframe);
			// Print the PDF when the iframe is loaded
			iframe.onload = () => iframe.contentWindow.print();
		} catch (error) {
			console.error('Failed to print the invoice:', error);
		}
	}
}
