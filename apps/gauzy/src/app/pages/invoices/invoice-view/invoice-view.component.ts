import { Component, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IInvoice, IUser } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { saveAs } from 'file-saver';
import { Store } from '@gauzy/ui-sdk/common';
import { InvoicesService } from '../../../@core/services';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms';
import { NbDialogService } from '@nebular/theme';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-view',
	templateUrl: './invoice-view.component.html',
	styleUrls: ['./invoice-view.component.scss']
})
export class InvoiceViewComponent extends TranslationBaseComponent implements OnInit {
	invoiceId: string;
	tenantId: string;
	invoice: IInvoice;

	@Input() isEstimate: boolean;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.paramMap.pipe(untilDestroyed(this)).subscribe(async (params) => {
			this.invoiceId = params.get('id');
		});
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe((user: IUser) => {
				this.tenantId = user.tenantId;
				if (this.invoiceId) {
					this.getInvoice();
				}
			});
	}

	async getInvoice() {
		const { tenantId } = this;
		const invoice = await this.invoicesService.getById(
			this.invoiceId,
			[
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
			],
			{ tenantId }
		);
		this.invoice = invoice;
	}

	async download() {
		const { id: invoiceId } = this.invoice;
		this.invoicesService
			.downloadInvoicePdf(invoiceId)
			.pipe(
				tap((data) => this.downloadFile(data)),
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

	edit() {
		const id = this.invoiceId;
		if (this.isEstimate) {
			this.router.navigate([`/pages/accounting/invoices/estimates/edit`, id]);
		} else {
			this.router.navigate([`/pages/accounting/invoices/edit`, id]);
		}
	}
	async delete() {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					isRecord: false,
					recordType: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE')
						: this.getTranslation('INVOICES_PAGE.INVOICE')
				}
			}).onClose
		);

		if (result) {
			await this.invoicesService.delete(this.invoiceId);
			if (this.isEstimate) {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_ESTIMATE');
				this.router.navigate([`/pages/accounting/invoices/estimates`]);
			} else {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_INVOICE');
				this.router.navigate([`/pages/accounting/invoices`]);
			}
		}
	}

	public async print(): Promise<void> {
		const { id: invoiceId } = this.invoice;
		const blob = await firstValueFrom(this.invoicesService.downloadInvoicePdf(invoiceId));
		const fileURL = URL.createObjectURL(blob);
		const iframe = document.createElement('iframe');
		iframe.src = fileURL;
		document.body.appendChild(iframe);
		iframe.onload = () => iframe.contentWindow.print();
	}
}
