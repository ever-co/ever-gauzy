import { Component, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IInvoice, IUser } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { saveAs } from 'file-saver';
import { InvoicesService, Store, ToastrService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-view',
	templateUrl: './invoice-view.component.html',
	styleUrls: ['./invoice-view.component.scss']
})
export class InvoiceViewComponent
	extends TranslationBaseComponent
	implements OnInit {
	invoiceId: string;
	tenantId: string;
	invoice: IInvoice;

	@Input() isEstimate: boolean;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.paramMap
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
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
}
